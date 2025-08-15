const express=require("express");
const app=express();
const cors=require('cors')
app.use(express.text());
app.use(cors());
const swc = require("@swc/core");
const {extractInfo}=require("./info.js")



const swc_app=require("./Api/SWC_API.js")
console.log("reached to api")

app.use('/swc-app', swc_app);

app.use((err, req, res, next) => {
  res.status(500).send({ message: "error occurred", error: err });
});

app.listen(4000,()=>console.log("Server is running on port 4000"));