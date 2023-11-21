const mongoose = require('mongoose');

const Product = new mongoose.Schema({
    title:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true
    },
    price:{
        type:Number,
        required:true
    },
    ingredients:{
        type:Array,
        required:true
    },
    images:{
        type:Array,
        required:false
    },
    category:{
        type:String,
        required:true
    }
})

module.exports = mongoose.model('Product',Product)