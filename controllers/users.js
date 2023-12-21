const mongoose = require('mongoose');
const User = require('../models/User');
const CustomAPIError = require('../error/CustomAPIError');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sendMail = require('./sendMail');
const Product = require('../models/Product');
const Ingredient = require('../models/Ingredient');
const Order = require('../models/Order');
const passwordStrength = require('zxcvbn');
const paypal = require('paypal-rest-sdk');
const compareArrays = require('../utils/compareArrays');
require('dotenv').config();
//Create Account

const createAccount = async(req,res) =>{
    const {firstname, lastname, email, password, age, phoneNumber, address} = req.body;

    if(!firstname || !lastname || !email || !password || !age || !phoneNumber)
    throw new CustomAPIError('Please fill in your information',400);

    try {
        const isExist = await User.find({email:email.toLowerCase()});
        if(isExist.length > 0)
        throw new CustomAPIError('This email is registered before, please try to login to your account',400);

    } catch (error) {
        throw new CustomAPIError('This email is registered before, please try to login to your account',400);
    }

    if(passwordStrength(password).score < 3)
    throw new CustomAPIError("Please use a stronger password",400)

    bcrypt.hash(password,10,async(err,hash) =>{

        try {
            const createdUser = await User.create({
                firstname:firstname,
                lastname:lastname,
                email:email.toLowerCase(),
                password:hash,
                address:address || [],
                phoneNumber:phoneNumber,
                age:Number(age),
                verificationCode:{
                    code:Math.floor(Math.random() * 9999999),
                    createdAt:Date(Date.now())
                }

            })


            await sendMail(email.toLowerCase(),createdUser.verificationCode.code);
            
            const data = {
                id:createdUser._id,
                email:createdUser.email,
                firstname:createdUser.firstname,
                lastname:createdUser.lastname,
               }

             const oneDay = 1000 * 60 * 60 * 24;
             const token = jwt.sign(data,process.env.JWT_SECRET,{expiresIn:'1d'});
             res.cookie('jwtToken',token,{secure:true,sameSite:'None',maxAge:oneDay});
             res.status(200).json({msg:"successfully created your account"})
        } catch (error) {
            console.log(error)
        }

    })

}

// Login

const login = async(req,res) =>{

    const { email, password } = req.body

    if(!email || !password)
    {
        throw new CustomAPIError("Please provide email and password",400)
    }
      
        const user = await User.find({email:email.toLowerCase()});

        if(user.length === 0)
        throw new CustomAPIError("This account is not registered yet, please try to create a new account",400);

            const match = bcrypt.compareSync(password,user[0].password);
            console.log(match)

               if(!match)
               return res.status(401).json({msg:"Email and password are not matched"});

               const data = {
                id:user[0]._id,
                email:user[0].email,
                firstname:user[0].firstname,
                lastname:user[0].lastname,
               }

               try {
                const cart = req.cookies.cart;
                if(cart)
                {
                 await User.findOneAndUpdate({_id:user[0].id},{cartItems:cart});
                }
                const oneDay = 1000 * 60 * 60 * 24;
                const token = jwt.sign(data,process.env.JWT_SECRET,{expiresIn:'1d'});
                res.cookie('jwtToken',token,{secure:true,sameSite:'None',maxAge:oneDay});
                res.status(200).json({msg:"Successfully logged in"});
               } catch (error) {
                console.log(error   )
                throw new CustomAPIError("Can't log you in ",500)
               }
         



}

//Mobile login

const mobileLogin = async(req,res) =>{

    const { email, password } = req.body

    if(!email || !password)
    {
        throw new CustomAPIError("Please provide email and password",400)
    }

        const user = await User.find({email:email.toLowerCase()});

        if(user.length === 0)
        {
            throw new CustomAPIError("This account is not registered yet, please try to create a new account",400)
        }
        else{
            bcrypt.compare(password,user[0].password,(err,result) =>{
               if(!result)
               return res.status(401).json({msg:"Email and password are not matched"});

               const data = {
                id:user[0]._id,
                email:user[0].email,
                firstname:user[0].firstname,
                lastname:user[0].lastname,
               }


               const oneDay = 1000 * 60 * 60 * 24;
               const token = jwt.sign(data,process.env.JWT_SECRET,{expiresIn:'1d'});
               res.status(200).json({
                msg:"Successfully logged in",
                status:200,
                token:token
            });

            })
        }

}

// check Auth

const checkAuth = async(req,res) =>{
    const token = req.cookies.jwtToken;
    
    if(!token)
    throw new CustomAPIError("Not authorized",401);

    try {
        const decodedToken = jwt.verify(token,process.env.JWT_SECRET);

        const user = await User.find({email:decodedToken.email});

        //payload
        const data = {
            id:user[0]._id,
            email:user[0].email,
            firstname:user[0].firstname,
            lastname:user[0].lastname,
            address:user[0].address,
            cartItems:user[0].cartItems,
            previousOrders:user[0].previousOrders,
            wishList:user[0].wishList,
            verified:user[0].verified,
            verificationCode:user[0].verificationCode,
            role:user[0].role,
            admin:user[0].admin
           }

         res.status(200).json({user:data});
    } catch (error) {
        console.log(error)
        throw new CustomAPIError("Invalid Token",498);
    }
}

//Verify

const verify = async (req,res) =>{


    if(req.user.verified)
    throw new CustomAPIError("Forbidden",403)
    
    const { code } = req.body;
    const { verificationCode, id } = req.user;
    const userCode = verificationCode.code;

    if(Number(code) !== Number(userCode))
    throw new CustomAPIError("Invalid verification code",400);

    try {
        await User.findOneAndUpdate({_id:id},{verified:true});

        res.clearCookie('jwtToken');

        res.status(200).json({msg:"Successfully verified your account"});
        
    } catch (error) {
        throw new CustomAPIError("Something went wrong",500)
    }

    
}


const addToCart = async(req,res) =>{
    try {


        const {productId, productQuantity, size, extras} = req.body;

        if(!productId || !productQuantity || !size || !extras)
        throw new CustomAPIError("Please provide product information",400)
    
        const user = req.user
        const isSigned = user ? true : false;
        const product = await Product.findById(productId);
      

        let temp_extra = [];
        let ingr =  [];
        let ingredients_titles =[] 
        let ingredients_qtys = {}


        const ingredients = await Ingredient.find({});

        ingredients.map((item) =>{
            ingredients_titles.push(item.title)
            ingredients_qtys = {...ingredients_qtys,[item.title]:item.quantity}
        })
    

        if(Object.keys(extras).length > 0)
        {
           const extrasKeys = Object.keys(extras)
           extrasKeys.forEach((key,index)=>{

            if(key.startsWith('extra') && ingredients_titles.includes(key.split('-')[1]))
            {
                if(ingredients_qtys[key.split('-')[1]] < 100)
                return res.status(400).json({msg:"Out of stock"})

                ingr.push(`${key.split('-')[1]}+`);
                temp_extra.push(key.split('-')[1]);
            }
           })

           extrasKeys.map((key,index)=>{

            if(ingredients_titles.includes(key) && !temp_extra.includes(key))
            {   
                if(ingredients_qtys[key] < 100)
                return res.status(400).json({msg:"Out of stock"})
                ingr.push(key)
            } 
           })
           
        }
        

       const cartObj = {
        id:product.id,
        size:size,
        qty:productQuantity,
        ingredients:ingr
    }

       if(!isSigned)
       {
            const browserCart = req.cookies.cart;

            //If empty
            if(!browserCart)
            {
                const fiveDays = 1000 * 60 * 60 * 24 * 5;
                res.cookie('cart',[cartObj],{secure:true,sameSite:'None',maxAge:fiveDays});
                return res.status(200).json({msg:"Successfully added the product to cart"})
            }
            //If not empty
            for(const item of browserCart)
            {
                if(compareArrays(item.ingredients,ingr) && item.id === product.id)
                return res.status(400).json({msg:"Product already in cart"});
            }

            const newCart = [
                browserCart,
                cartObj
            ].flat()
            const fiveDays = 1000 * 60 * 60 * 24 * 5;
            res.cookie('cart',newCart,{secure:true,sameSite:'None',maxAge:fiveDays});
            return res.status(200).json({msg:"Successfully added the product to cart"})
    }

    const userCart = user[0].cartItems;
    //If empty
    if(userCart.length === 0)
    {
        await User.findByIdAndUpdate({_id:user[0].id},{cartItems:[cartObj]});
        return res.status(200).json({ms:"Sucessfully added the product to cart"})
    }
    //If not empty
    for(const item of user[0].cartItems)
    {
        if(compareArrays(item.ingredients,ingr) && item.id === product.id)
        return res.status(400).json({msg:"Product already in cart"});
    }

    const newCart = [
        user[0].cartItems,
        cartObj
    ].flat()

    await User.findByIdAndUpdate({_id:user[0].id},{cartItems:newCart});
    return res.status(200).json({ms:"Sucessfully added the product to cart"})
        
    } catch (error) {
        console.log(error)
        throw new CustomAPIError("Something went wrong while adding to cart",500)

    }
}

//Cart items 

const cartItems = async(req,res) =>{
   const user = req.user;
   const isSigned = req.user ? true : false;
   const cart = !isSigned ? req.cookies.cart : user[0].cartItems;
   let total_price = 0;
   let cartItems = [];

    if(!cart)   
    throw new CustomAPIError("Cart is empty",404);

    const ids = cart.map((item) =>{
        return item.id
    });


    try {
        let products = []
        for (item of cart)
        {
            const product = await Product.find({_id:item.id});
            products.push(product[0])
        }
        products.forEach((item,index) =>{

            let increaseFactor = 0
            cart[index].ingredients.forEach((item) =>{
                item.endsWith('+') ?  increaseFactor += 7 : ''
            })

            const cartObj = {
                id:item.id,
                title:item.title,
                price: (item.price + increaseFactor + ((cart[index].size - 150) * item.price_per_unit)) * cart[index].qty,
                ingredients:cart[index].ingredients,
                images:item.images,
                size:cart[index].size,
                qty:cart[index].qty
            }
            console.log(cartObj)
            total_price += cartObj.price
            cartItems.push(cartObj)
        })

        res.status(200).json({cart:cartItems,total_price:total_price})

    } catch (error) {
        console.log(error)
        throw new CustomAPIError("Something went wrong",500);
    }


//    res.status(200).json(cart)

//    const ids = cart.map((item) =>{
//     return item.id
//    })

//    try {
//     let cartItems = []
//     let total_price = 0
//     const products = await Product.find({_id:{$in:ids}});
//     products.map((item,index) =>{
//         const cartObject = {
//             id:item.id,
//             title:item.title,
//             price:cart[index].price,
//             ingredients:cart[index].ingredients,
//             images:item.images,
//             size:cart[index].size,
//             qty:cart[index].qty
//         }
//         cartItems.push(cartObject)
//         total_price += cart[index].price
//     })

//     res.status(200).json({cart:cartItems,total_price:total_price})


//    } catch (error) {
//         throw new CustomAPIError("Something went wrong",500);
//    }

}


const removeFromCart = async(req,res) =>{
    const { id } = req.body;
    console.log(id)
    try {
        
        const cart = req.cookies.cart;
        const updatedCart = cart.filter(item => item.id != id );
        const fiveDays = 1000 * 60 * 60 * 24 * 5;
        res.cookie('cart',updatedCart,{secure:true,sameSite:'None',maxAge:fiveDays});
        res.status(200).json({msg:`Product with id ${id} has been removed`})
    } catch (error) {
        console.log(error)
    }
}

//Clear cart

const clearCart = async(req,res) =>{
    res.clearCookie('cart');
    res.status(200).json({msg:"Cart items deleted"})
}

// Make order


const makeOrder = async(req,res) =>{
    console.log(req.user)
}


// const makeOrder = async(req,res) =>{
//     const cart = req.cookies.cart;
//     const user = req.user
//     if(!cart)
//     throw new CustomAPIError("Cart is empty",400);
//     console.log(cart)

//     try {
//         let ingredientsToDiscount = {}
//         let ingredientsToDiscountTitles = []
//         let ingredientsToDiscountValues = []
//         let total_price = 0

//         let cartIngredients = []

//         const ingredients = await Ingredient.find({});
//         const ingredients_titles = ingredients.map((item) =>{
//             return item.title
//         })

//         cart.map((item) =>{
//             total_price += item.price
//             item.ingredients.map((ingr) =>{
//                 if(ingr.endsWith('+'))
//                 {
//                     cartIngredients.push(ingr.split('+')[0])
//                     cartIngredients.push(ingr.split('+')[0])
//                 }
//                 else{
//                     cartIngredients.push(ingr.split('+')[0])
//                 }
//             })
//         })

//         cartIngredients.map((item) =>{
//            ingredientsToDiscount = {...ingredientsToDiscount,[item]:ingredientsToDiscount[item] ?
//            ingredientsToDiscount[item] + 30 : 30
//             }
//         })

//         for(key in ingredientsToDiscount)
//         {
//             ingredientsToDiscountTitles.push(key)
//             ingredientsToDiscountValues.push(ingredientsToDiscount[key])

//             ingredients.map((item) =>{
//                 if(item.title === key )
//                  ingredientsToDiscount[key] = (item.quantity - ingredientsToDiscount[key])
//             })
//         }        

//         console.log(ingredientsToDiscount)


//         for (key in ingredientsToDiscount)
//         {
//             await Ingredient.findOneAndUpdate({title:key},{quantity:ingredientsToDiscount[key]})
//         }

//         console.log(total_price)

//         const createdOrder = await Order.create({
//             title:`${user.firstname}'s Order`,
//             items:cart,
//             userID:user.id,
//             address:user.address[0],
//             total_price:total_price,
//         })


//         await User.findOneAndUpdate({_id:user.id},{previousOrders:[user.previousOrders,createdOrder].flat()})

//         res.status(200).json({msg:"Success"})

//     } catch (error) {
//         console.log(error)
//     }

// }



//Logout

const logout = async(req,res) =>{
    const token = req.cookies.jwtToken;

    if(!token)
    throw new CustomAPIError("No token provided",404);

    res.clearCookie('jwtToken',{secure:true,sameSite:'None'});
    res.status(200).json({msg:'Logged out'});
}

const createPay = ( payment ) => {
    return new Promise( ( resolve , reject ) => {
        paypal.payment.create( payment , function( err , payment ) {
         if ( err ) {
             reject(err); 
         }
        else {
            resolve(payment); 
        }
        }); 
    });
}						


const payment  = async ( req , res ) => {
    try {
        const paymenT = {
            "intent": "authorize",
	"payer": {
		"payment_method": "paypal"
	},
	"redirect_urls": {
		"return_url": "http://127.0.0.1:8080/success",
		"cancel_url": "http://127.0.0.1:8080/err"
	},
	"transactions": [{
		"amount": {
			"total": 39.00,
			"currency": "USD"
		},
		"description": " a book on mean stack "
	}]
    }
	
	
	// call the create Pay method 
    createPay( paymenT ) 
        .then( ( transaction ) => {
            var id = transaction.id; 
            var links = transaction.links;
            var counter = links.length; 
            while( counter -- ) {
                if ( links[counter].method == 'REDIRECT') {
					// redirect to paypal where user approves the transaction 
                    return res.redirect( links[counter].href )
                }
            }
        })
        .catch( ( err ) => { 
            console.log( err ); 
        });
    } catch (error) {
        console.log(error)
    }
	// create payment object 
   
}; 
 

module.exports = {
    createAccount,
    login,
    mobileLogin,
    checkAuth,
    logout,
    verify,
    addToCart,
    cartItems,
    clearCart,
    makeOrder,
    removeFromCart,
    payment
}