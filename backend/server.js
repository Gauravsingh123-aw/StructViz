const express=require("express");
const app=express();
const cors=require('cors')
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.text({ type: ["text/*", "application/javascript", "application/typescript"], limit: "2mb" }));

const swc_app=require("./Api/SWC_API.js")
console.log("reached to api")

app.use('/swc-app', swc_app);

app.use((err, req, res, next) => {
  res.status(500).send({ message: "error occurred", error: err });
});

app.listen(4000,()=>console.log("Server is running on port 4000"));
