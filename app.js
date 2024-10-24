const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const ejs = require('ejs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "views" directory
app.use(express.static('views'));

// Usar rutas relativas dentro del proyecto
const dbPath = path.resolve(__dirname, './movies.db');
const db = new sqlite3.Database(dbPath);

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.render('index');
});

// Búsqueda de películas, actores y directores
app.get('/buscar', (req, res) => {
    const searchTerm = req.query.q;
    const type = req.query.type; 

    let query = '';
    let params = [`%${searchTerm}%`];

    if (type === 'movie') {
        query = `SELECT 'movie' as type, title as name, movie_id as id
                  FROM movie
                  WHERE title LIKE ?`;
    } else if (type === 'actor') {
        query = `SELECT DISTINCT 'actor' as type, person_name as name, p.person_id as id 
                  FROM person p
                  INNER JOIN movie_cast mc on p.person_id = mc.person_id
                  WHERE person_name LIKE ?`;
    } else if (type === 'director') {
        query = `SELECT DISTINCT 'director' as type, person_name as name, p.person_id as id 
                  FROM person p
                  INNER JOIN movie_crew mcr on p.person_id = mcr.person_id
                  WHERE job = 'Director' 
                  AND person_name LIKE ?`;
    } else if (type === 'keyword') {
        query = `SELECT DISTINCT 'keyword' as type, m.title as name, m.movie_id as id
                  FROM movie m
                  INNER JOIN movie_keywords mk ON m.movie_id = mk.movie_id
                  INNER JOIN keyword k ON mk.keyword_id = k.keyword_id
                  WHERE keyword_name LIKE ?`;
    } else {
        return res.status(400).send('Tipo de búsqueda no válido. Debe ser "movie", "actor" o "director".');
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error en la búsqueda.'); 
        } else {
            res.render('resultado', { results: rows, searchTerm, type });
        }
    });
});

// Ruta para la página de datos de una película particular
app.get('/pelicula/:id', (req, res) => {
    const movieId = req.params.id;

    const query = `
        SELECT *
        FROM movie m 
        -- Géneros
        inner join movie_genres mg ON m.movie_id = mg.movie_id
        inner join genre ON mg.genre_id = genre.genre_id
        -- Production Countries
        inner join production_country pcoun ON m.movie_id = pcoun.movie_id
        inner join country ON pcoun.country_id = country.country_id
        -- Companies
        inner join movie_company mcom ON m.movie_id = mcom.movie_id
        inner join production_company pcom ON mcom.company_id = pcom.company_id
        -- Languages
        inner join movie_languages mlan ON m.movie_id = mlan.movie_id
        inner join language ON mlan.language_id = language.language_id
        -- Crew
         inner join movie_crew mcr ON m.movie_id = mcr.movie_id
         inner join department ON mcr.department_id = department.department_id
        -- Cast
        inner join movie_cast ON m.movie_id = movie_cast.movie_id
        inner join person ON movie_cast.person_id = person.person_id
        
        WHERE m.movie_id = ? AND mcr.job = 'Director' 
    `;

    db.all(query, [movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar los datos de la película.');
        } else if (rows.length === 0) {
            res.status(404).send('Película no encontrada.');
        } else {
            const movieData = {
                id: rows[0].movie_id,
                title: rows[0].title,
                release_date: rows[0].release_date,
                overview: rows[0].overview,
                directors: [],
                writers: [],
                cast: [],
                crew: [],
                genres: [],
                production_company: rows[0].company_name,
                movie_language: rows[0].language_name,
                production_countries: [],
                keywords: [],
            };

            rows.forEach((row) => {
                // Agregar géneros
                if (row.genre_name && !movieData.genres.includes(row.genre_name)) {
                    movieData.genres.push(row.genre_name);
                }

                // Agregar países de producción
                if (row.country_name && !movieData.production_countries.includes(row.country_name)) {
                    movieData.production_countries.push(row.country_name);
                }

                // Agregar directores y escritores
                if (row.person_name) {
                    if (row.job === 'Director' && !movieData.directors.includes(row.person_name)) {
                        movieData.directors.push(row.person_name); // Agrega el director si no está ya
                    } else if (row.job === 'Writer' && !movieData.writers.includes(row.person_name)) {
                        movieData.writers.push(row.person_name); // Agrega el escritor si no está ya
                    }
                }

                // Agregar miembros del elenco
                if (row.cast_order && row.character_name) {
                    // Verificar que el actor no esté ya en el elenco
                    const actorExists = movieData.cast.some(actor => actor.actor_id === row.person_id);
                    if (!actorExists) {
                        movieData.cast.push({
                            actor_id: row.person_id, // ID del actor
                            actor_name: row.person_name, // Nombre del actor
                            character_name: row.character_name, // Nombre del personaje
                            cast_order: row.cast_order // Orden del elenco
                        });
                    }
                }

                // Agregar miembros del crew
                if (row.job && row.person_name) {
                    // Verificar que el miembro del crew no esté ya en el elenco
                    const crewExists = movieData.crew.some(crewMember => crewMember.crew_member_name === row.person_name && crewMember.job === row.job);
                    if (!crewExists) {
                        movieData.crew.push({
                            crew_member_name: row.person_name, // Nombre del miembro del crew
                            department_name: row.department_name, // Nombre del departamento
                            job: row.job // Trabajo del miembro del crew
                        });
                    }
                }
            });

            // Renderizar la vista
            res.render('pelicula', { movie: movieData });
        }
    });
});

// Ruta para mostrar la página de un actor específico
app.get('/actor/:id', (req, res) => {
    const actorId = req.params.id;

    const query = `
        SELECT DISTINCT
            person.person_name as actorName,
            movie.*
        FROM movie  
        INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
        INNER JOIN person ON person.person_id = movie_cast.person_id
        WHERE movie_cast.person_id = ?;
    `;

    db.all(query, [actorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del actor.');
        } else {
            const actorName = movies.length > 0 ? movies[0].actorName : '';
            res.render('actor', { actorName, movies });
        }
    });
});

// Ruta para mostrar la página de un director específico
app.get('/director/:id', (req, res) => {
    const directorId = req.params.id;

    const query = `
        SELECT DISTINCT
            person.person_name as directorName,
            movie.*
        FROM movie  
        INNER JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
        INNER JOIN person ON person.person_id = movie_crew.person_id
        WHERE movie_crew.person_id = ?;
    `;

    db.all(query, [directorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del director.');
        } else {
            const directorName = movies.length > 0 ? movies[0].directorName : '';
            res.render('director', { directorName, movies });
        }
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
