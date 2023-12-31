require('express-async-errors');
const express = require('express');
const app = express();
const path = require('path')
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const connectDB = require('./db/connect');
const axios = require('axios');
const cors = require('cors')
require('dotenv').config();
const bodyParser = require('body-parser');
const crypto = require('crypto');
const paypal = require('paypal-rest-sdk');

//middleware
const errorHandlerMiddleware = require('./middleware/error-handler-middleware');

app.use(cors({
    origin: ['https://xfood.onrender.com','http://localhost:3000','http://localhost:5173'], // Replace with your actual frontend origin
    credentials: true,
  }));
app.use(bodyParser.urlencoded({
    extended:false
}))
app.use(express.json());
app.use(cookieParser());
app.use(cookieSession({
    name:'session',
    keys:[crypto.randomBytes(32).toString('hex'),crypto.randomBytes(32).toString('hex')],
    domain:'https://xfood.onrender.com',
    path:'/'

}))
app.use(express.static('./dist'))

// configure paypal with the credentials you got when you created your paypal app
paypal.configure({
    'mode': 'sandbox', //sandbox or live 
    'client_id': 'AS23jny-ZHy0JKOc1On1JzHEBNhNMjyV4f4TIA0X-9ydA4Rwk-30qlChEqnSxHgX_0d7X13-HYkJqcQe', // please provide your client id here 
    'client_secret': 'EMyHvzVsx8JiBMUOVlZ0USfeVJ-UnQo9JlwSE6Zlcuc8eg2XidapqX9RDn6zTnaFT5760P-Ym9fN9reH' // provide your client secret here 
  });
  
  

//routes
const usersRoute = require('./routes/users-route');
const adminsRoute = require('./routes/admin-route');
const productsAPIRoute = require('./routes/products-api-route');

app.use('/',usersRoute);
app.use('/admin',adminsRoute);
app.use('/products',productsAPIRoute);

app.use(errorHandlerMiddleware);

const port = process.env.PORT || 3000;

app.get('/',(req,res) =>{
    res.sendFile(path.resolve('./view/index.html'))
})


//Preventing Scale Down

app.get('/self-ping',(req,res) =>{
    res.status(200).json({msg:"Successfully pinged"})
})

setInterval(async() =>{

    try {
        const { data } = await axios.get('https://xfood.onrender.com/self-ping');
        
    } catch (error) {
    }


},1000 * 60 )

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