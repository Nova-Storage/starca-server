const express = require("express");
const app = express();
const pool  = require("./db");
const bodyParser = require('body-parser');
const bcrypt = require("bcrypt");
const session = require('express-session');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require("path");
const dotenv = require("dotenv");
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const {promisify} = require("util");
const cors =require('cors');

dotenv.config({ path:'./.env'});

//Middleware
// parse incoming requests

//cors
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus:200,
}

app.use(cors(corsOptions))

app.use(bodyParser.json());
app.use(cookieParser());


app.use(session({
  secret: 'mysecret',
  resave: false,
  saveUninitialized: false
}));


/*
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    return cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    return cb(null, "${Date.now()}-${file.type}");
  },
});
*/
const upload = multer({
   dest: './uploads',
 });

const stripe = require('stripe')(`${process.env.STRIPE_SECRET_KEY}`);

var myUserId = ''

app.use(express.urlencoded({ extended: false }));

app.get('/', async (req, res) => {
  res.send('Welcome to Starca Server')
  const account = await stripe.accounts.create({type: 'express'});
  account = await stripe.accounts.retrieve('{{CONNECTED_ACCOUNT_ID}}');

});



app.post('/register', async (req, res) => {

    const { email, passwrd, confirmPassword, ufname, ulname, uphnum, ustreet, ucity, ustate, uzip } = req.body;

    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      business_type: 'individual',
      email: email,
      capabilities: {
        us_bank_account_ach_payments: {
          requested: true
        },
        card_payments: {
          requested: true
        },
        transfers: {
          requested: true
        }
      },
      individual: {
        first_name: ufname,
        last_name: ulname,
        phone: uphnum,
        address: {
          city: ucity,
          country: 'US',
          line1: ustreet,
          postal_code: uzip,
          state: ustate
        }
      },
      business_profile: {
        product_description: "Storage Space Rentals",
        name: `${ufname} ${ulname}`,
        mcc: '4225'
      }
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'http://localhost:3001/login',
      return_url: 'http://localhost:3001/login',
      type: 'account_onboarding',
    })

    // const accountUpdate = await stripe.accounts.update(
    //   account.id,
    //   {
    //     tos_acceptance: {
    //       date: Date.now(),
    //       ip: req.socket.remoteAddress
    //     }
    //   }
    // )

    try {
  
        if (!email || !passwrd || !confirmPassword || !ufname || !ulname || !uphnum || !ustreet || !ucity || !ustate || !uzip) {
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
        const insertQuery = 'INSERT INTO susers(email, passwrd, ufname, ulname, uphnum,  ustreet, ucity, ustate, uzip, ustripeid) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id';
        const values = [email, hashedPassword, ufname, ulname, uphnum,  ustreet, ucity, ustate, uzip, account.id];
        const insertUserResult = await pool.query(insertQuery, values);
        
        res.status(201).json({
          message: 'You have successfully registered!',
          account_link_url: accountLink['url']
        });
        
          
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
        let userId = user.id;
        let stripeId = user.ustripeid
        req.session.userId = userId;

        const account = await stripe.accounts.retrieve(stripeId);
        accountInfo = await stripe.accounts.update(stripeId);

        // Check if a user with the given email exists
        if (!user) {
            return res.redirect('/register?error=Incorrect email or password');
        }

        // Check if the password is correct
        const passwordMatch = await bcrypt.compare(passwrd, user.passwrd);
        if (!passwordMatch) {
            return res.redirect('/login?error=Incorrect email or password');
        } else {
          //const id = result[0].id;

          const token = jwt.sign({userId}, process.env.JWT_SECRET, {
              expiresIn: process.env.JWT_EXPIRES_IN
          });

          console.log("The token is: " + token);

          const cookieOptions = {
              expires: new Date( 
                  Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000 
              ),
              httpOnly:true
          }

          res.cookie('jwt', token, cookieOptions );
         // res.status(200).redirect("/profile");
      } 


      if (account["charges_enabled"] === false) {
        
        const accountLink = await stripe.accountLinks.create({
          account: account.id,
          refresh_url: 'http://localhost:3001/login',
          return_url: 'http://localhost:3001/login',
          type: 'account_onboarding',
        })

        res.json({
          message: "You Logged In!",
          stripe_connected: false,
          stripe_link_url: accountLink['url'], 
        })
      }
        
      else {
        res.status(200).json({
        message: "You Logged In!",
        userID: userId
      })
      myUserId = userId
    };
      
        //res.redirect('/profile');

    } catch (err) {
      console.error(err);
      res.status(500).send('Error logging in.');
    }
  });


  app.post('/get-user-names', (req, res) => {

    const {email} = req.body;

    pool.query('SELECT email, ufname, ulname FROM susers WHERE email = $1', [email], (err, result) => {

        console.log(email); 

        if (err) {
        console.error(err);
        res.status(500).send('Not connecting to the server');
        return;
      }

      if (result.rows.length === 0) {
        // No user found with the given email
        res.status(404).send('User not found');
        return;
      }

      // Render the profile page with the user data
      res.json(result.rows[0]);
    });
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

  
exports.isLoggedIn = async(req, res, next) =>{
  // console.log(req.cookies);
   if(req.cookies.jwt){
    try {
        // 1. Verify the token
        const decoded = await promisify(jwt.verify)(req.cookies.jwt,process.env.JWT_SECRET);
            console.log(decoded);

        // 2. User Existense Check
        db.query("SELECT * FROM susers WHERE id = ?",[decoded.id], (error, result) =>{
            console.log(result);

            if(!result){
                return next();
            }

            req.user = result[0];
            return next();
        })

    } catch (error) {
        console.log(error);
        return next();
    }
   }else {
    next();
   }
}


app.get('/logout',(req, res) => {
   
    res.cookie('jwt', 'logout',{
      expires: new Date(Date.now() + 2*1000),
      httpOnly: true
    });

    res.status(200).redirect("/");
  });


app.get('/profile',async(req, res,next) => {
   
});
  
app.post('/listing',upload.array("image",5), async (req, res, next) => {

  const{ltitle, ldescr, llen, lwid, lheight, lprice, lstreet,lcity, lstate, lzip, lcountry,lseccamara, lclicontroll, lbiometric, lwhaccess} = req.body;
  //const image = req.files;
  //const userId = req.user.id;

  let userId = 18
  let userStripeId = 'acct_1MzG2pQXM5WjR9f1'

 
  try {
    const insertListing = await pool.query(
      'INSERT INTO slistings(ltitle, ldescr, llen, lwid, lheight, lprice, lstreet,lcity, lstate, lzip, lcountry,lseccamara, lclicontroll, lbiometric, lwhaccess, luserid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *',
      [ltitle, ldescr, llen, lwid, lheight, lprice, lstreet,lcity, lstate, lzip, lcountry,lseccamara, lclicontroll, lbiometric, lwhaccess, 18]
    );

    if (insertListing.rows.length > 0) {
      const lid = insertListing.rows[0].lid;

      let temp = lprice * 100

      // Create product for the listing on Stripe. Using the listingID as the productID
      const product = await stripe.products.create({
        id: lid,
        name: `${ltitle} Storage`,
        description: `${ltitle} Storage in ${lcity}, ${lstate} ${lzip}`,
        metadata: {
          "listing_address": `${lstreet}, ${lcity}, ${lstate} ${lzip}`
        },
        default_price_data: {
          currency: "USD",
          unit_amount: temp,
          recurring: {
            interval: 'month'
          },
        }
      },
      {stripeAccount: userStripeId})

      const getProducts = await stripe.products.retrieve(`${lid}`, {stripeAccount: userStripeId})
      console.log(getProducts['default_price'])

    } else {
      console.error('Failed to insert listing');
      res.status(500).json({ message: 'Failed to insert listing' });
    }
       
    var response = ''; 
    // for(var i=0;i<req.files.length;i++){
    //     response += `<img src="${req.files[i].path}" /><br>`
    //     //console.log(req.files[i].path);

    //     pool.query('SELECT lid FROM slistings WHERE userid = $1', [userId], (err, result) => {
  
    //       if (err) {
    //       console.error(err);
    //       res.status(500).send('Not connecting to the server');
    //       return;
    //     }
  
    //     if (result.rows.length === 0) {
    //       res.status(404).send('list not found');
    //       return;
    //     }
    //     let listid = result.rows[0];
        
    //   });
    //   const listid = 1;
    //     pool.query('INSERT INTO slistImages (listid, image_path) VALUES ($1,$2)', [listid,req.files[i].path], function(err, result) {
    //       //done();
    //       if(err) {
    //           return console.error('error running query', err);
    //       }
    //       console.log('Image inserted into the database');
    //   });
    // }

   // const lid = insertListing.rows[0].id;
  //  console.log(lid);
/*
    const insertImages = images.map((image)=> {
      
      const imageQuery = 'INSERT INTO slistImages( filename, filedata) VALUES ($1, $2)';
      const imageData = image.buffer;
      const imageValues = [ image.filename, imageData];
      
      return {query: imageQuery , values: imageValues};

    });

    await Promise.all(images.map((q) => pool.query(q.query, q.values)));

    res.status(200).json({message: 'New Listing Created Successfully'}); 
    */
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});


app.get('/glisting', async (req, res) => {
  const id = req.params.id;

  try {
    const query = `
      SELECT s.*, li.filename, li.filedata
      FROM slistings s
      INNER JOIN slistImages li ON s.LID = li.listid
      WHERE s.LID = $1;
    `;
    const values = [id];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.get('/get-listings', async (req, res) => {

  try {
    const query = `
      SELECT *
      FROM slistings
    `;

    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No listings found' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.get('/get-my-listings', async (req, res) => {
  const id = req.params.id;

  try {
    const query = `
      SELECT *
      FROM slistings
      WHERE luserid = $1
    `;

    values = [id];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No listings found' });
    }

    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post('/forgotPassword', async (req, res) => {
  var randomstring = require("randomstring");
  const { email } = req.body
  
  // Generate Reset Password Token
  const token = randomstring.generate({
    length:200,
  })
  const currentTime = new Date()
  const tokenExp = new Date(currentTime.getTime() + (60 * 60 * 1000))
  pool.query(`
      UPDATE susers 
      SET uResPassToken = $1, urespasstokenexp = $3
      WHERE email = $2
      RETURNING ufname, urespasstokenexp
    `
    , [token, email, tokenExp])
    .then((result) => {
      if (result.rowCount === 0) {
        res.status(404).json({ message: 'There is no account with the provided email.'})
      }
      // User Exists; Send email with link
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'jaimeen3195sharma@gmail.com',
          pass: 'etuhuwtomuinbjea',
        },
      });
      const mailOptions = {
        from: {
          name: 'noreply@starca.com',
          address:'jaimeen3195sharma@gmail.com',
        },
        to: email,
        subject: 'Starca Reset Password',
        html: `Hello ${result.rows[0].ufname}, <br /> <p>Please click this <a href="${process.env.PAGE_BASE_URL}/resetPassword/?token=${token}&email=${email}&exp=${result.rows[0].urespasstokenexp}">link</a> to reset your password. The link will expire in 1 hour.</p>`,
      };
      transporter.sendMail(mailOptions);

      res.status(200).json({message: `An email was sent to ${email}`})
    })
    .catch((error) => {
      console.error(error)
    })
})

app.post('/resetPassword', async (req, res) => {

  // If we got here:
  // 1. User exists
  // 2. Password is valid
  // 3. Token has not expired

  // Have to:
  // 1. Check if token from body === token in DB 
  // 2. If it does :
  //    2.1. Grab password from body
  //    2.2. Update Password in database (salt + hash stuff)
  //    2.3. Return success
  // 3. If it doesn't :
  //    3.1 Return error, instruct user to request new token.

  // Grab data from request body
  const { email, token, passwrd } = req.body

  // Hash the password using bcrypt
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(passwrd, salt);

  pool.query(`
    UPDATE susers 
    SET passwrd = $3
    WHERE email = $1 AND urespasstoken = $2
  `, [email, token, hashedPassword])
    .then((result) => {
      if (result.rowCount === 0) {
        res.status(404).json({ message: 'Error resetting password. Please try requesting a new link.'})
      }
      else {
        res.status(200).json({message: 'You have successfully reset your password!'});
      }
    })
    .catch((error) => {
      console.error(error)
    })
})

app.post('/create-checkout-session', async (req, res) => {

  const { lid, ownerID, renterID } = req.body
  pool.query(`SELECT ustripeid, email from susers where id = $1 or id = $2`, [ownerID, renterID])
  .then(async (result) => {
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Error retrieving Owner\'s ID.'})
    }
    else {

      let ownerStripeId = result.rows[0].ustripeid
      // let ownerStripeId = "acct_1MzG2pQXM5WjR9f1"
      let ownerEmail = result.rows[0].email
      let renterStripeId = result.rows[1].ustripeid
      // let renterStripeId = "acct_1MzGIdH8iLYs43p6"
      let renterEmail = result.rows[1].email


      const product = await stripe.products.retrieve(`${lid}`, {stripeAccount: ownerStripeId})
      // console.log(product)
      console.log(typeof(product['default_price']))
      const getPrice = await stripe.prices.retrieve(product['default_price'], {stripeAccount: ownerStripeId})

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{
          price: `${product['default_price']}`,
          quantity: 1
        }],
        customer_email: renterEmail,
        subscription_data: {
          application_fee_percent: 0.08,
          metadata: {
            listingId: lid,
            ownerId: ownerID,
            ownerStripeId: ownerStripeId
          },
        },
        success_url: 'http://localhost:3001/login',
        cancel_url: 'http://localhost:3001/register',
      },
      {stripeAccount: `${ownerStripeId}`})


      if (session.complete) {
        console.log('DONE')
      }

      // console.log(session.url)
      res.status(200).json({message: "Checkout Link Created", checkout_link: `${session.url}`})
    }
  })
  .catch((error) => {
    console.error(error)
  })
})
  
module.exports = app;
