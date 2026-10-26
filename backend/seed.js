const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Movie = require('./models/Movie');
const Theatre = require('./models/Theatre');
const Show = require('./models/Show');
const Seat = require('./models/Seats');

dotenv.config();

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/imovies');
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data
    await Movie.deleteMany({});
    await Theatre.deleteMany({});
    await Show.deleteMany({});
    await Seat.deleteMany({});

    // 1. Create Sample Movies
    const movies = await Movie.insertMany([
      {
        title: 'Inception',
        description: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea.',
        genre: 'Sci-Fi / Action',
        language: 'English',
        duration: 148,
        posterUrl: 'https://image.tmdb.org/t/p/w500/edv5CZvWj09upO2SSz19A1KM23E.jpg'
      },
      {
        title: 'Interstellar',
        description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity survival.',
        genre: 'Sci-Fi / Adventure',
        language: 'English',
        duration: 169,
        posterUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
      },
      {
        title: 'The Dark Knight',
        description: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological tests.',
        genre: 'Action / Crime',
        language: 'English',
        duration: 152,
        posterUrl: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg'
      }
    ]);

    // 2. Create Sample Theatre
    const theatre = await Theatre.create({
      name: 'Grand Cinema Screen 1',
      location: 'Downtown Mall',
      city: 'Central City',
      totalScreens: 1,
      totalSeats: 20
    });

    // 3. Create Shows and Seats for EVERY movie so none return "Movie not found"
    for (let movie of movies) {
      const show = await Show.create({
        movie: movie._id,
        theatre: theatre._id,
        showTime: new Date(Date.now() + 86400000), // Tomorrow
        ticketPrice: 250
      });

      const seatArray = [];
      const rows = ['A', 'B', 'C'];
      let count = 0;

      for (let r of rows) {
        for (let i = 1; i <= 7; i++) {
          if (count >= 20) break;
          seatArray.push({
            show: show._id,
            seatNumber: `${r}${i}`,
            isBooked: false
          });
          count++;
        }
      }

      await Seat.insertMany(seatArray);
    }

    console.log('Database Seeded Successfully with Shows for all movies!');
    process.exit();
  } catch (err) {
    console.error('Seeding Error:', err);
    process.exit(1);
  }
};

seedDB();