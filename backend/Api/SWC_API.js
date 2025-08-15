const express=require("express");
const swc_app=express.Router();

const expressasynchandler = require('express-async-handler');

const { swc_module } = require('../utility/swc_module.js');
console.log("reached to api")
swc_app.post('/convert', expressasynchandler(swc_module));

module.exports = swc_app;
