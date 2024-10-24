const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const ejs = require('ejs');
//probando tema de pull si alguien cambia el main antes(2da vez)
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "views" directory
app.use(express.static('views'));

// Faca me ves? 
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

    // Consulta para obtener los datos de la película
    const movieQuery = `
    SELECT * FROM movie WHERE movie_id = ?;
    `;

    // Consulta para obtener el elenco de la película
    const castQuery = `
    SELECT 
        actor.person_name AS actor_name,
        actor.person_id AS actor_id,
        movie_cast.character_name,
        movie_cast.cast_order
    FROM 
        movie_cast 
    LEFT JOIN person AS actor ON movie_cast.person_id = actor.person_id
    WHERE movie_cast.movie_id = ?;
    `;

    // Consulta para obtener el equipo de la película
    const crewQuery = `
    SELECT 
        crew_member.person_name AS crew_member_name,
        crew_member.person_id AS crew_member_id,
        department.department_name,
        movie_crew.job
    FROM 
        movie_crew 
    LEFT JOIN department ON movie_crew.department_id = department.department_id
    LEFT JOIN person AS crew_member ON crew_member.person_id = movie_crew.person_id
    WHERE movie_crew.movie_id = ?;
    `;

    // Consulta para obtener los géneros de la película
    const genreQuery = `
    SELECT 
        genre.genre_name
    FROM 
        movie_genres 
    LEFT JOIN genre ON movie_genres.genre_id = genre.genre_id
    WHERE movie_genres.movie_id = ?;
    `;

    // Consulta para obtener las compañías de producción de la película
    const productionCompanyQuery = `
    SELECT 
        production_company.name AS company_name
    FROM 
        movie_company
    LEFT JOIN production_company ON movie_company.company_id = production_company.company_id
    WHERE movie_company.movie_id = ?;
    `;

    // Consulta para obtener los idiomas de la película
    const languageQuery = `
    SELECT 
        language.language_name
    FROM 
        movie_languages 
    LEFT JOIN language ON movie_languages.language_id = language.language_id
    WHERE movie_languages.movie_id = ?;
    `;

    // Consulta para obtener los países de producción de la película
    const countryQuery = `
    SELECT 
        country.country_name
    FROM 
        production_country 
    LEFT JOIN country ON production_country.country_id = country.country_id
    WHERE production_country.movie_id = ?;
    `;

    // Consulta para obtener las palabras clave de la película
    const keywordQuery = `
    SELECT 
        keyword.keyword_name
    FROM 
        movie_keywords 
    LEFT JOIN keyword ON movie_keywords.keyword_id = keyword.keyword_id
    WHERE movie_keywords.movie_id = ?;
    `;

    // Ejecutar la consulta de la película
    db.get(movieQuery, [movieId], (err, movieRow) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error al cargar los datos de la película.');
        } 
        if (!movieRow) {
            return res.status(404).send('Película no encontrada.');
        }

        // Inicializar el objeto de película
        const movieData = {
            id: movieRow.movie_id,
            title: movieRow.title,
            release_date: movieRow.release_date,
            overview: movieRow.overview,
            directors: [],
            writers: [],
            cast: [],
            crew: [],
            genres: [],
            company_name: [],
            languages: [],
            countries: [],
            keywords: []
        };

        // Ejecutar las consultas restantes en paralelo
        const queries = [
            { query: castQuery, target: 'cast' },
            { query: crewQuery, target: 'crew' },
            { query: genreQuery, target: 'genres' },
            { query: productionCompanyQuery, target: 'company_name' },
            { query: languageQuery, target: 'languages' },
            { query: countryQuery, target: 'countries' },
            { query: keywordQuery, target: 'keywords' },
        ];

        let completedQueries = 0;

        // Ejecutar todas las consultas
        queries.forEach(({ query, target }) => {
            db.all(query, [movieId], (err, rows) => {
                if (err) {
                    console.error(err);
                } else {
                    if (target === 'cast') {
                        rows.forEach(row => {
                            movieData.cast.push({
                                actor_id: row.actor_id,
                                actor_name: row.actor_name,
                                character_name: row.character_name,
                                cast_order: row.cast_order,
                            });
                        });
                    } else if (target === 'crew') {
                        rows.forEach(row => {
                            // Agregar lógica para separar directores y escritores si es necesario
                            if (row.job === 'Director') {
                                movieData.directors.push({
                                    crew_member_id: row.crew_member_id,
                                    crew_member_name: row.crew_member_name,
                                });
                            } else if (row.job === 'Writer') {
                                movieData.writers.push({
                                    crew_member_id: row.crew_member_id,
                                    crew_member_name: row.crew_member_name,
                                });
                            } else {
                                movieData.crew.push({
                                    crew_member_id: row.crew_member_id,
                                    crew_member_name: row.crew_member_name,
                                    department_name: row.department_name,
                                    job: row.job,
                                });
                            }
                        });
                    } else {
                        rows.forEach(row => {
                            movieData[target].push(target === 'genres' ? row.genre_name : target === 'company_name' ? row.company_name : target === 'languages' ? row.language_name : target === 'countries' ? row.country_name : row.keyword_name);
                        });
                    }
                }

                completedQueries++;
                // Verificar si todas las consultas han terminado
                if (completedQueries === queries.length) {
                    res.render('pelicula', { movie: movieData });
                }
            });
        });
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