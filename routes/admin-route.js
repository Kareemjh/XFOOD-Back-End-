const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({dest:'./uploads/'})

//controllers
const {
    addIngredient,
    deleteIngredient,
    editIngredient,
    addProduct,
    updateProduct,
    deleteProduct,
    addOffer,
    viewOrders
} = require('../controllers/Admins');   

//middleware

const adminAuthorization = require('../middleware/admin-authorization-middleware');

//Ingredients routes
router.route('/add-ingredient').post(adminAuthorization,addIngredient);
router.route('/delete-ingredient').delete(adminAuthorization,deleteIngredient);
router.route('/edit-ingredient').patch(adminAuthorization,editIngredient);
router.route('/add-product').post(adminAuthorization,upload.array('images'),addProduct);
router.route('/update-product').patch(adminAuthorization,upload.array('images'),updateProduct);
router.route('/delete-product').delete(adminAuthorization,deleteProduct);
router.route('/add-offer').post(adminAuthorization,upload.single('images'),addOffer);
router.route('/orders').get(adminAuthorization,viewOrders);


//Products route



module.exports = router