// routes/productRoutes.js
import express from 'express';
import { client } from '../dbConfig.js';
import { ObjectId } from 'mongodb';

const router = express.Router();
const MYDB = client.db('Batch-5');
const Products = MYDB.collection('Students'); // use consistent collection name

// Create product
router.post('/user/product', async (req, res) => {
  try {
    const product = {
      title: req.body.title || '',
      category: req.body.category || '',
      image: req.body.image || '',
      description: req.body.description || '',
      price: Number(req.body.price) || 0,
      createdAt: new Date(),
    };

    const response = await Products.insertOne(product);
    console.log('Inserted product id:', response.insertedId);

    if (response.insertedId) {
      return res.status(201).json({
        success: true,
        message: 'Product added successfully',
        product: { _id: response.insertedId, ...product },
      });
    } else {
      return res.status(500).json({ success: false, message: 'Failed to add product' });
    }
  } catch (err) {
    console.error('POST /user/product error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Get products
router.get('/user/product', async (req, res) => {
  try {
    const allProducts = await Products.find({}).toArray();
    return res.status(200).json(allProducts);
  } catch (err) {
    console.error('GET /user/product error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

export default router;
