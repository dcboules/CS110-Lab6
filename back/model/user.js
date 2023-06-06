const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        required: true,
        type: String
    },
    password: {
        required: true,
        type: String
    },
    name: {
        type: String,
        required: true,
    },
    rooms: [{
        type: mongoose.Schema.Types.ObjectId, ref: 'Room',
        required: true,
    }],
    pfp: {
        type: String,
        required: false,
    }, 

})

module.exports = mongoose.model('User', userSchema)