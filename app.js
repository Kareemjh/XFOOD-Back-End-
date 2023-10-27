require('express-async-errors');
const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const connectDB = require('./db/connect');
require('dotenv').config();

//middleware
const errorHandlerMiddleware = require('./middleware/error-handler-middleware');

app.use(express.json());
app.use(cookieParser());

//routes
const usersRoute = require('./routes/users-route');

app.use('/',usersRoute)

app.use(errorHandlerMiddleware);

const port = process.env.PORT || 3000;

const start = async() =>{
    try {
        await connectDB(process.env.MONGO_URI)
        app.listen(port,() =>{
            console.log(`Server is Running at port ${port}...`)
        })
    } catch (error) {
        console.log(error)
    }
}

start()