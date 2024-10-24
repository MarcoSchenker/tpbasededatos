const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const ejs = require('ejs');
//probando tema de pull si alguien cambia el main antes(2da vez)
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "views" directory
app.use(express.static('views'));

// Path completo de la base de datos movies.db
// Por ejemplo 'C:\\Users\\datagrip\\movies.db'
// Aca se usa la ruta absoluta
//const db = new sqlite3.Database('C:/Users/nacug/Faculty/base-de-datos/tpbasededatos/movies.db');

// Agrego codigo para que se use la ruta relativa y no haya problemas de actualización.
const path = require('path');

// Usa rutas relativas dentro del proyecto
const dbPath = path.resolve(__dirname, './movies.db');
const db = new sqlite3.Database(dbPath);

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.render('index');
});

// 1. Búsqueda de películas, actores y directores (Terminado)
// Puede buscar cada uno y los muestra en secciones separadas

app.get('/buscar', (req, res) => {
    const searchTerm = req.query.q;
    // Como tengo que buscar por peli, director o actor entonces creamos una variable type para identificar en que tabla buscar. 
    // Este type es el que le pasamos en index.ejs (en la caja)
    const type = req.query.type; 

    let query = '';
    let params = [`%${searchTerm}%`]; //Parametro que recibe

    // Seleccionamos la consulta SQL dependiendo del tipo de búsqueda (dependiendo el type)
    if (type === 'movie') {
        query = `SELECT 'movie' as type, title as name, movie_id as id
        FROM movie
        WHERE title LIKE ?`;
    } else if (type === 'actor') {
        query = `
            SELECT DISTINCT 'actor' as type, person_name as name, p.person_id as id 
            FROM person p
            INNER JOIN movie_cast mc on p.person_id = mc.person_id
            WHERE person_name LIKE ?
        `;
    } else if (type === 'director') {
        query = `
            SELECT DISTINCT 'director' as type, person_name as name, p.person_id as id 
            FROM person p
            INNER JOIN movie_crew mcr on p.person_id = mcr.person_id
            WHERE job = 'Director' 
            AND person_name LIKE ?
        `;
    } else if (type === 'keyword') { //pongo consulta sql para buscar por keyword
        query = `
        SELECT DISTINCT 'keyword' as type, m.title as name, m.movie_id as id
        FROM movie m
        INNER JOIN movie_keywords mk ON m.movie_id = mk.movie_id
        INNER JOIN keyword k ON mk.keyword_id = k.keyword_id
        WHERE keyword_name LIKE ?
        `;
    }

    else {
        //Si no se le pasa el tipo entonces envio un error.
        return res.status(400).send('Tipo de búsqueda no válido. Debe ser "movie", "actor" o "director".');
    }


    // Ejecutamos la consulta (query guarda la consulta, params es lo que buscas, rows son las filas a mostrar)
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error en la búsqueda.'); 
        } else {
            // Filtramos los resultados por el tipo. SearchTerm es el params
            res.render('resultado', { results: rows, searchTerm, type });
        }
    });
});

//Este es el Buscar orginal, lo dejamos por las dudas para saber la estructura de como hacerlo.
/*
// Ruta para buscar películas   
app.get('/buscar', (req, res) => {
    const searchTerm = req.query.q;

    // Realizar la búsqueda en la base de datos
    db.all(
        'SELECT * FROM movie WHERE title LIKE ?',
        [`%${searchTerm}%`],
        (err, rows) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            } else {
                res.render('resultado', { movies: rows });
            }
        }
    );
});
*/

// Ruta para la página de datos de una película particular
app.get('/pelicula/:id', (req, res) => {
    const movieId = req.params.id;
    //Te tiene que devolver: Genero, Todo lo de la tabla peli, Pais produccion, la compañia, lenguaje
    // Consulta SQL para obtener los datos de la película, elenco y crew
    const query = `
    SELECT
      movie.*,
      actor.person_name as actor_name,
      actor.person_id as actor_id,
      crew_member.person_name as crew_member_name,
      crew_member.person_id as crew_member_id,
      movie_cast.character_name,
      movie_cast.cast_order,
      department.department_name,
      movie_crew.job,


    ------------------CODIGO NUEVO-------------------
      genre.genre_name,
      production_company.company_name as production_company,
      language.language_name as movie_language,
      country.country_name
      keyword.keyword_name as movie_keyword

    -------------------------------------------------
    FROM movie
    LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    LEFT JOIN person as actor ON movie_cast.person_id = actor.person_id
    LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    LEFT JOIN department ON movie_crew.department_id = department.department_id
    LEFT JOIN person as crew_member ON crew_member.person_id = movie_crew.person_id
    
    -----------------CODIGO NUEVO---------------------
    -- genero de la pelicula
    LEFT JOIN movie_genres ON movie.movie_id = movie_genres.movie_id
    LEFT JOIN genre ON movie_genres.genre_id = genre.genre_id

        -- nombre de la compañia de produccion
    LEFT JOIN movie_company ON movie.movie_id = movie_company.movie_id
    LEFT JOIN production_company ON movie_company.company_id = production_company.company_id

        -- lenguaje de la pelicula
    LEFT JOIN movie_languages ON movie.movie_id = movie_languages.movie_id
    LEFT JOIN language ON movie_languages.language_id = language.language_id

        -- pais de produccion
    LEFT JOIN production_country ON movie.movie_id = production_country.movie_id
    LEFT JOIN country ON production_country.country_id = country.country_id
        -----------------------------------------------
    -- keyword de la pelicula
    LEFT JOIN  movie_keywords ON movie.movie_id = movie_keywords.movie_id
    LEFT JOIN keyword On movie_keywords.keyword_id = keyword.keyword_id
    WHERE movie.movie_id = ?
  `;

    // Ejecutar la consulta
    db.all(query, [movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar los datos de la película.');
        } else if (rows.length === 0) {
            res.status(404).send('Película no encontrada.');
        } else {
            // Organizar los datos en un objeto de película con elenco y crew
            const movieData = {
                id: rows[0].id,
                title: rows[0].title,
                release_date: rows[0].release_date,
                overview: rows[0].overview,
                directors: [],
                writers: [],
                cast: [],
                crew: [],
                genres: [],  // Nuevo campo para géneros
                production_company: rows[0].production_company, // Nuevo campo para compañía de producción
                movie_language: rows[0].movie_language, // Nuevo campo para idioma de la película
                production_countries: [], // Nuevo campo para países de producción
                keywords: [], // Nuevo campo para palabras clave
            };

            // Agregar géneros
            rows.forEach((row) => {
                if (row.genre_name) {
                    movieData.genres.push(row.genre_name);
                }

                if (row.country && !movieData.production_countries.includes(row.country)) {
                    movieData.production_countries.push(row.country);
                }

                if (row.movie_keyword && !movieData.keywords.includes(row.movie_keyword)) {
                    movieData.keywords.push(row.movie_keyword);
                }
            });

            // Crear un objeto para almacenar directores
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    const isDuplicate = movieData.directors.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate && row.department_name === 'Directing' && row.job === 'Director') {
                        movieData.directors.push({
                            crew_member_id: row.crew_member_id,
                            crew_member_name: row.crew_member_name,
                            department_name: row.department_name,
                            job: row.job,
                        });
                    }
                }
            });

            // Crear un objeto para almacenar writers
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    const isDuplicate = movieData.writers.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate && row.department_name === 'Writing' && row.job === 'Writer') {
                        movieData.writers.push({
                            crew_member_id: row.crew_member_id,
                            crew_member_name: row.crew_member_name,
                            department_name: row.department_name,
                            job: row.job,
                        });
                    }
                }
            });

            // Crear un objeto para almacenar el elenco
            rows.forEach((row) => {
                if (row.actor_id && row.actor_name && row.character_name) {
                    const isDuplicate = movieData.cast.some((actor) =>
                        actor.actor_id === row.actor_id
                    );

                    if (!isDuplicate) {
                        movieData.cast.push({
                            actor_id: row.actor_id,
                            actor_name: row.actor_name,
                            character_name: row.character_name,
                            cast_order: row.cast_order,
                        });
                    }
                }
            });

            // Crear un objeto para almacenar el crew
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    const isDuplicate = movieData.crew.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate && 
                        row.department_name !== 'Directing' && row.job !== 'Director' &&
                        row.department_name !== 'Writing' && row.job !== 'Writer') {
                        movieData.crew.push({
                            crew_member_id: row.crew_member_id,
                            crew_member_name: row.crew_member_name,
                            department_name: row.department_name,
                            job: row.job,
                        });
                    }
                }
            });

            res.render('pelicula', { movie: movieData });
        }
    });
});


// Ruta para mostrar la página de un actor específico
app.get('/actor/:id', (req, res) => {
    const actorId = req.params.id;

    // Consulta SQL para obtener las películas en las que participó el actor
    const query = `
    SELECT DISTINCT
      person.person_name as actorName,
      movie.*
    FROM movie  
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON person.person_id = movie_cast.person_id
    WHERE movie_cast.person_id = ?;
  `;

    // Ejecutar la consulta
    db.all(query, [actorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del actor.');
        } else {
            // Obtener el nombre del actor
            const actorName = movies.length > 0 ? movies[0].actorName : '';

            res.render('actor', { actorName, movies });
        }
    });
});

// Ruta para mostrar la página de un director específico
app.get('/director/:id', (req, res) => {
    const directorId = req.params.id;

    // Consulta SQL para obtener las películas dirigidas por el director
    const query = `
    SELECT DISTINCT
      person.person_name as directorName,
      movie.*
    FROM movie
    INNER JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    INNER JOIN person ON person.person_id = movie_crew.person_id
    WHERE movie_crew.job = 'Director' AND movie_crew.person_id = ?;
  `;


    // console.log('query = ', query)

    // Ejecutar la consulta
    db.all(query, [directorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del director.');
        } else {
            // console.log('movies.length = ', movies.length)
            // Obtener el nombre del director
            const directorName = movies.length > 0 ? movies[0].directorName : '';
            res.render('director', { directorName, movies });
        }
    });
});


// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});