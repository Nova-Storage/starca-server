const express = require("express");
const app = express();
const pool  = require("./db");
const bodyParser = require('body-parser');
const bcrypt = require("bcrypt");
const session = require('express-session');
const nodemailer = require('nodemailer');

//Middleware
// parse incoming requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


// define middleware to check if the user is authenticated

/*
const authenticateUser = (req, res, next) => {
    if (req.session.userId) {
      next();
    } else {
      res.redirect('/login');
    }
  };
*/

app.get('/', async (req, res) => {

    res.send('Welcome to Starca Server')

  });

app.post('/register', async (req, res) => {

    const { email, passwrd, confirmPassword, fname, lname, phnum } = req.body;

    try {
  
        if (!email || !passwrd || !confirmPassword || !fname || !lname || !phnum) {
        return res.status(400).send('All Fields are Required.');
        }
    
        if (passwrd !== confirmPassword) {
        return res.status(400).send('Passwords do not match.');
        }

          // Check if the user already exists
        const existingUser = await pool.query('SELECT * FROM susers WHERE email=$1', [email]);
        if (existingUser.rows.length !== 0) {
        res.status(400).send('User already exists');
        return;
        }

         // Hash the password using bcrypt
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(passwrd, salt);

        // Insert the user into the database
        const insertQuery = 'INSERT INTO susers(email, passwrd, fname, lname, phnum) VALUES($1, $2, $3, $4, $5) RETURNING id';
        const values = [email, hashedPassword, fname, lname, phnum];
        const insertUserResult = await pool.query(insertQuery, values);
        
        res.status(201).send('You have successfully registered!');
        
          
          // Send email notification
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'jaimeen3195sharma@gmail.com',
              pass: 'etuhuwtomuinbjea',
            },
          });
      
          const mailOptions = {
            from: 'jaimeen3195sharma@gmail.com',
            to: email,
            subject: 'Registration Notification',
            text: 'This is starca Registration Portal, You have successfully registered.',
          };

          transporter.sendMail(mailOptions);
          console.log('Notification email sent to ${email}');
       
        //const userId = insertUserResult.rows[0].id;
        //req.session.userId = userId;

        //res.redirect('/login');

    }catch (error) {
        console.log(error);
        res.status(400).send('Error registering user');
    }
});

app.post('/login', async (req, res) => {

    const { email, passwrd } = req.body;
    
    try {
  
        if (!email || !passwrd) {
        return res.status(400).send('Email and password are required.');
        }
        
        // Query the database for the user with the given email
        const query = 'SELECT * FROM susers WHERE email = $1';
        const result = await pool.query(query, [email]);
        const user = result.rows[0];

        // Check if a user with the given email exists
        if (!user) {
            return res.redirect('/register?error=Incorrect email or password');
        }

        // Check if the password is correct
        const passwordMatch = await bcrypt.compare(passwrd, user.passwrd);
        if (!passwordMatch) {
            return res.redirect('/login?error=Incorrect email or password');
        }

        res.send("You Logged in.!");
           
        //req.session.userId = user.id;
        //res.redirect('/profile');

    } catch (err) {
      console.error(err);
      res.status(500).send('Error logging in.');
    }
  });

  app.post('/boundary', async (req, res) => {

    const { state, zipCode } = req.body;
    
    try {
        if (!zipCode || !state) {
          return res.status(400).send('Zip Code and state required.');
        }

        let paths = []
        let jsonFile = require(`./zipcodes/${state}.json`)
        const boundaries = jsonFile.features.find(element => element.properties.ZCTA5CE10 === `${zipCode}`)
        for (var i = 0; i < boundaries.geometry.coordinates[0].length; i++) {
          paths.push({
            lat: boundaries.geometry.coordinates[0][i][1],
            lng: boundaries.geometry.coordinates[0][i][0]
          })
        }

        // Send back the array of all coordinates
        res.send(paths);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error retrieving boundary.');
    }
  });

  
/*
app.get('/logout', (req, res) => {
    // Clear the user ID from the session
    req.session.id = null;
    
    // Redirect the user to the login page or home whatever you decide
    res.redirect('/login');
  });
app.get('/profile', (req, res) => {
    // Check if the user is logged in
    if (!req.session.id) {
      // Redirect the user to the login page
      res.redirect('/login');
      return;
    }
  
    // Get the user data from the database
    pool.query('SELECT * FROM susers WHERE id = $1', [req.session.id], (err, result) => {
        
        console.log(req.session.id);
        if (err) {
        console.error(err);
        res.status(500).send('Not connecting to the server');
        return;
      }
      
      if (result.rows.length === 0) {
        // No user found with the given ID
        res.status(404).send('User not found');
        return;
      }
      
      // Render the profile page with the user data
      const user = result.rows[0];
      res.render('profile', { user });
    });
  });
  */

module.exports = app;
