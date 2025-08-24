import express from "express";
import { client } from "../dbConfig.js";
import { ObjectId } from "mongodb";
const router = express.Router();
const MYDB = client.db("Batch-5");
const Products = MYDB.collection("Students");

router.post('/user/product', async (req, res) => {
    const product = {
        title: req.body.title,
        description: req.body.description,
        price: req.body.price,
        createdAt: Date.now()
    }

    const response = await Products.insertOne(product)
    if(response) {
        return res.send("Product Added Successfully")
    }else{
        return res.send("Something Went Wrong")
    }
})

router.get('/user/product', async (req, res) => {
    const Allproducts = Products.find()
    const response = await Allproducts.toArray()
    console.log(response);
    if(response.length > 0) {
        return res.send(response)
    }else{
        return res.send("No Product Found")
    }
})

router.delete('user/product:id', async (req, res) => {
    const productId = new ObjectId(req.params.id)

    const deleteProduct = await Products.deleteOne({_id: productId})
    if (deleteProduct) {
        return res.send("product Deleted");
    }else {
        return res.send("Something Went Wrong");
    }
})

export default router
