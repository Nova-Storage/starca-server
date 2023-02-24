/*var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
*/
require('dotenv').config();

const express = require('express')
const app = express()
const fs = require('fs')
const pgp = require('pg-promise')()

app.use(express.json());

// Connect to DB
const connection = {
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT
}

const db = pgp(connection)

app.get('/', function (req, res) {
 return res.send('Starca Server');
});

app.get('/ping', function (req, res) {
 return res.send('pong');
});


app.get('/test', function (req, res) {
  db.any('SELECT * FROM testuser')
          .then(function (data){
                console.log('Data', data);
                res.send(data);
                //res.end(data.toString());
        })
          .catch(function (error) {
                console.log('Error', error);
                res.end('Database query error' + error);
        })
});

module.exports = app;
