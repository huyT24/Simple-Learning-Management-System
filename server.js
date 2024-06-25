'use strict';

const express = require('express');
const fs = require('fs');
const { get } = require('http');
const multer = require('multer');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');
const app = express();

app.use(express.static('public'));

// for application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true })); // built-in middleware // for application/json
app.use(express.json()); // built-in middleware
// for multipart/form-data (required with FormData)
app.use(multer().none());

// Announcements

app.get('/api/announcements', async (req, res) => {
    try {
        let db = await getDBConnection();
        let results = await db.all('SELECT * FROM Announcement');
        res.json(results);
    } catch (error) {
        console.log(error);
    }
})

// Register form
app.post('/api/register', async (req, res) => {
    let out = {
        success: true,
        err: ""
    }

    try {
        let db = await getDBConnection();
        let username = req.body.username;
        let email   = req.body.email;
        let password = req.body.password;
        let confirmpassword = req.body.confirmpassword;
        const hash = await bcrypt.hash(password, 10);

        
        let result = await db.get('SELECT * FROM User Where user_name = ?', username);
        let regexUsername = /^[0-9a-zA-Z_.-]+$/;
        if (!(regexUsername.test(username))) {
            out.success = false;
            out.err = 'Username is invalid!';
        }


        let regexEmail = /^\w+([\._]?\w+)*@gmail.com$/;
        if(!(regexEmail.test(email))) {
            out.success = false;
            out.err = 'Email is invalid!';
        }
 
        if (result !== undefined) {
            out.success = false;
            out.err = 'Username already exists!';
        }

        if(password.length < 3) {
            out.success = false;
            out.err = 'Password is too short!';
        }

        if(password !== confirmpassword) {
            out.success = false;
            out.err = "Confirm password doesn't match password!"
        }

        if(out.success) {
            await db.run('INSERT INTO User (user_name, user_password, user_email) VALUES (?,?,?)', username, hash, email);
        }

        res.json(out);
        await db.close();
    } catch (error) {
        console.log(error);
    }
})


// Login form 

app.post('/api/login', async (req, res) => {
    let out = {
        success: true,
        err: ""
    }

    try {
        let db = await getDBConnection();
        let username = req.body.username;
        let password = req.body.password;


        let regexUsername = /^[0-9a-zA-Z_.-]+$/;
        if (!(regexUsername.test(username))) {
            out.success = false;
            out.err = 'Username is invalid!';
        }

        let resultUsername = await db.get('SELECT user_name FROM User Where user_name = ?', username);
        let resultPassword = await db.get('SELECT user_password FROM User Where user_name = ?', username);
        console.log(resultPassword)
        
        const isPassValid = await bcrypt.compare(password, resultPassword['user_password']);

        if (resultUsername === undefined) {
            out.success = false;
            out.err = 'Username is incorrect!';
        } else if(resultPassword === undefined) {
            out.success = false;
            out.err = 'Password is incorrect!'
        } else if(username !== resultUsername['user_name']) {
            out.success = false;
            out.err = 'Username is incorrect!';
        } else if (!isPassValid) {
            out.success = false;
            out.err = 'Password is incorrect!';
        }
        res.json(out);
        await db.close();
    } catch (error) {
        console.log(error);
    }
})

// all courses 

app.get('/api/all/courses', async (req, res) => {
    try {
        let cookie = req.headers.cookie.split(';')[2];
        let cookieName = cookie.substring(cookie.indexOf('=') + 1);
        let db = await getDBConnection();
        let results = await db.all('SELECT * FROM Course WHERE Course.course_name NOT IN( SELECT Course.course_name FROM(Course INNER JOIN Enrollment ON Course.course_id = Enrollment.course_id INNER JOIN User ON User.user_id = Enrollment.user_id) WHERE Enrollment.user_id IN (SELECT User.user_id FROM User WHERE User.user_name = ?))', cookieName);
        res.json(results);
    } catch (error) {
        console.log(error);
    }
})

//my course

app.get('/api/my/courses', async (req, res) => {
    try {
        let cookie = req.headers.cookie.split(';')[2];
        let cookieName = cookie.substring(cookie.indexOf('=') + 1);
        let db = await getDBConnection();
        let results = await db.all('SELECT * FROM Course WHERE Course.course_name IN( SELECT Course.course_name FROM(Course INNER JOIN Enrollment ON Course.course_id = Enrollment.course_id INNER JOIN User ON User.user_id = Enrollment.user_id) WHERE Enrollment.user_id IN (SELECT User.user_id FROM User WHERE User.user_name = ?))', cookieName);
        res.json(results);
    } catch (error) {
        console.log(error);
    }
})


// enroll course

app.get('/api/all/courses/enroll/:course_name/:user_name', async (req, res) => {
    try {
        let course_name = req.params.course_name;
        let user_name = req.params.user_name.substring(req.params.user_name.indexOf('=') + 1);
        let db = await getDBConnection();
        let course_id = await db.all('SELECT course_id FROM Course WHERE course_name = ?', course_name.toString());
        let user_id = await db.all('SELECT user_id FROM User WHERE user_name = ?', user_name.toString());
        let run = await db.exec('INSERT INTO Enrollment VALUES ('+[course_id[0]['course_id'].toString()+', '+user_id[0]['user_id'].toString()]+')');

        res.json('successful');
    } catch (error) {
        console.log(error);
    }
})


// Course page

app.get('/api/course/:course_id/quizes', async (req, res) => {
    try {
        let course_id = req.params.course_id;
        let db = await getDBConnection();
        let result = await db.all('SELECT course_name FROM Course WHERE course_id = ?', course_id);
        res.json(result);
    } catch (error) {
        console.log(error)
    }
}) 


// render quizz

app.get('/api/doquiz/:quizz_id', async (req, res) => {
    try {
        let quizz_id = req.params.quizz_id;
        let db = await getDBConnection();
        let result = await db.all("SELECT Question.q_id, Question.data, Question.quizz_id FROM (Question INNER JOIN Quizz ON Question.quizz_id = Quizz.quizz_id) WHERE Quizz.quizz_id = ?", quizz_id);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
})


// do quizz 

app.post('/api/course/:course_id/doquiz/:quizz_id', async (req, res) => {
   try {
        let quizz_id = req.params.quizz_id;
        let db = await getDBConnection();
        let result = await db.all("SELECT Question.q_id, Question.data, Question.quizz_id FROM (Question INNER JOIN Quizz ON Question.quizz_id = Quizz.quizz_id) WHERE Quizz.quizz_id = ?", quizz_id);
        res.json(result);
   } catch (error) {
       console.log(error)
   }
})

const PORT = process.env.PORT || 8000;
app.listen(PORT);


    
async function getDBConnection() {
    const db = await sqlite.open({
        filename : 'HanuProjectDB.db',
        driver   : sqlite3.Database
    });
    return db;
}
    