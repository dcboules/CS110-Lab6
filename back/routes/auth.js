const express = require('express');
const User = require('../model/user');
const Room = require('../model/room');
const router = express.Router()
const speakeasy = require("speakeasy");
const nodemailer = require("nodemailer");
const sgMail = require('@sendgrid/mail');
require('dotenv').config()

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// route handles GET requests to the root URL
router.get('/', (req, res) => {
    if (req.session && req.session.authenticated) {
        res.json({ message: "logged in" });
        console.log("logged in");
    } else {
        console.log("not logged in");
        res.json({ message: "not logged in" });
    }
});

// Set up a route for the login page (with 2fa)
router.post('/login', async (req, res) => {
    const { session } = req;
    const { email, password } = req.body;

    // check if user in database
    const user = await User.findOne({ email });

    if (!user)
        return res.json({ msg: "Incorrect Email ", status: false });
    else if (user.password !== password)
        return res.json({ msg: "Incorrect Password", status: false });
    else {
        let token = speakeasy.totp({
            secret: user.secret,
            encoding: "base32",
        });
        const msg = {
            to: user.email,
            from: "dboul001@ucr.edu",
            subject: "CS110 Login Verification",
            html: `<h1>Your 2FA token is: ${token}</h1>`
        };
        sgMail.send(msg);
        
        req.session.authenticated = true;
        req.session.user = user;
        req.session.userId = user._id;
        req.session.save((err) => {
            if(err) {
                console.log(err);
            } else {
                console.log(user, "in log in this is the user");
                console.log("**** SESSION AFTER .SAVE() ****", req.session);
                res.status(200).json({ msg: "logged in", tokenRequired: true, user: user });
            }
        });
    }
});

// route to verify 2fa token:
router.post('/verify', async (req, res) => {
    const { token, user } = req.body;
    console.log("req.session:", req.session);
    console.log("Entered Token:", token);
    if (!user || !user.email) {
        return res.json({ msg: "User not found", status: false });
    }
    const email = user.email;
    console.log("Email from session:", email);    
    console.log("User from database:", user)
    if (!user) {
        return res.json({ msg: "User not found", status: false });
    }
    const { username } = user;
    const { session } = req;
    let tokenIsValid = speakeasy.totp.verify({
        secret: user.secret,
        encoding: "base32",
        token: token,
        window: 2
    });
    console.log("Token validation result:", tokenIsValid);
    if (tokenIsValid) {
        req.session.authenticated = true;
        req.session.userId = user._id;
        req.session.user = user;
        req.session.save(async (err) => {
            if(err) {
                console.log(err);
            } else {
                const userRooms = await Room.find({ users: user._id });
                user.rooms = userRooms;
                res.json({ msg: "logged in", user: user, status: true });
            }
        });
    } else {
        return res.json({ msg: "Incorrect Token", status: false });
    }
});

// Set up a route for the logout page
router.post('/logout', async (req, res) => {
    // Clear the session data and redirect to the home page
    req.session.destroy();
    res.send({ msg: "logged out", status: true })
});

// Set up a route for the signup page
router.post('/signup', async (req, res) => {
    const { email, password, name, username } = req.body;
    let secret = speakeasy.generateSecret({ length: 20 });
    const user = new User({
        email: email,
        username: username,
        password: password,
        name: name,
        secret: secret.base32,
        pfp: null
    })
    if ((await User.findOne({ email })) != null) {
        res.send(JSON.stringify("Email already registered"));
    } else {
        try {
            const dataSaved = await user.save();
            res.status(200).json({ dataSaved, status: 200 });
        }
        catch (error) {
            console.log(error);
            res.send("ERROR!");
        }
    }
})


router.post('/editPFP', async (req, res) => {
    const { newProfilePic, username } = req.body;
    const user = await User.findOne({ username });
    user.pfp = newProfilePic;
    await user.save();
});

router.post('/editname', async (req, res) => {
    const { newName, username } = req.body;
    const user = await User.findOne({ username });
    user.name = newName;
    await user.save();
});

module.exports = router;
