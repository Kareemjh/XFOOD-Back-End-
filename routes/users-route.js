const express = require('express');
const router = express.Router();

const mobileAuthMiddleware = require('../middleware/mobile-auth');
const requiredAuth = require('../middleware/required-auth');
const isAuth = require('../middleware/isAuth');

const {
    createAccount,
    login,
    checkAuth,
    logout,
    mobileLogin,
    verify,
    addToCart,
    cartItems,
    clearCart,
    makeOrder,
    removeFromCart,
    payment
} = require('../controllers/users');

const {
    getBotRespond,
} = require('../controllers/AI');

router.route('/register').post(createAccount);
router.route('/login').post(login);
router.route('/mobile-login').post(mobileLogin)
router.route('/check-auth').get(checkAuth);
router.route('/logout').post(logout)
router.route('/verify').post(requiredAuth,verify);
router.route('/send-msg').post(getBotRespond);
router.route('/add-to-cart').post(isAuth,addToCart)
router.route('/cart-items').get(cartItems)
router.route('/clear-cart').get(clearCart)
router.route('/make-order').post(requiredAuth,makeOrder);
router.route('/remove-from-cart').post(removeFromCart),
router.route('/payment').get(payment)



module.exports = router