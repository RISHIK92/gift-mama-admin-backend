import express from "express";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import adminAuth from "../auth/adminAuth.js";
import multer from "multer";
import { uploadFileToS3 } from "./s3config.js";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const JWT_SECRET = "123123";

const upload = multer({ storage: multer.memoryStorage() });

app.post("/admin/register", async (req, res) => {
  const { firstName,lastName,phone, email, password } = req.body;

  try {
    const adminExists = await prisma.admin.findUnique({
      where: { email },
    });

    if (adminExists) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await prisma.admin.create({
      data: { firstName, lastName, email, password: hashedPassword, phone },
    });

    res.status(201).json({ message: "Admin registered successfully", admin: newAdmin });
  } catch (error) {
    console.error("Error registering admin:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin Sign-In
app.post("/admin/signin", async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET);
    res.status(200).json({ message: "Admin logged in successfully", token });
  } catch (error) {
    console.error("Error signing in admin:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/admin/dashboard", adminAuth, async (req, res) => {
  const email = req.admin.email;

  try {
    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true }
    });

    const users = await prisma.user.count();
    const products = await prisma.product.count();

    if (!admin) {
      return res.status(400).json({ message: "Admin not found" });
    }

    res.status(200).json({ message: "Welcome to the Admin Dashboard", admin, users, products });
  } catch (error) {
    console.error("Error fetching admin dashboard:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/admin/get-users", adminAuth, async (req, res) => {

  try {
    const admin = await prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, phone: true }
    });

    if (!admin) {
      return res.status(400).json({ message: "Admin not found" });
    }

    res.status(200).json({ message: "Welcome to the Admin Dashboard", admin: admin });
  } catch (error) {
    console.error("Error fetching admin dashboard:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/admin/add-users", adminAuth, async (req,res) => {

})

app.delete("/admin/delete-user/:userId", adminAuth, async (req, res) => {
  const { userId } = req.params;
  
  try {
    const userExists = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });
    
    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }
    
    await prisma.user.delete({
      where: { id: parseInt(userId) },
    });
    
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get('/admin/get-products',adminAuth, async(req,res) => {
  try {
    const product = await prisma.product.findMany({
      include: { images: true }
    });

    if (!product) {
      return res.status(400).json({ message: "Admin not found" });
    }

    res.status(200).json({ message: "Welcome to the Admin Dashboard", product });
  } catch (error) {
    console.error("Error fetching admin dashboard:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
})

app.get("/admin/get-sections", adminAuth, async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.status(200).json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Add a new category
app.post("/admin/add-section", adminAuth, async (req, res) => {
  const { category } = req.body;
  
  try {
    // Check if category already exists
    const existingCategory = await prisma.category.findFirst({
      where: { category: { equals: category, mode: 'insensitive' } }
    });
    
    if (existingCategory) {
      return res.status(400).json({ message: "Category already exists" });
    }
    
    const newCategory = await prisma.category.create({
      data: {
        category,
        subCategory: []
      }
    });
    
    res.status(201).json({ message: "Category added successfully", category: newCategory });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update a category
app.put("/admin/update-section/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  const { category } = req.body;
  
  try {
    // Check if the category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) }
    });
    
    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    // Check if the new name already exists (excluding the current category)
    const nameExists = await prisma.category.findFirst({
      where: {
        category: { equals: category, mode: 'insensitive' },
        id: { not: parseInt(categoryId) }
      }
    });
    
    if (nameExists) {
      return res.status(400).json({ message: "Category name already exists" });
    }
    
    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(categoryId) },
      data: { category }
    });
    
    res.status(200).json({ message: "Category updated successfully", category: updatedCategory });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete a category
app.delete("/admin/delete-section/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  
  try {
    // Check if the category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) }
    });
    
    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    // Delete the category
    await prisma.category.delete({
      where: { id: parseInt(categoryId) }
    });
    
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/admin/add-subsection", adminAuth, async (req, res) => {
  const { categoryId, subcategoryName } = req.body;
  
  try {
    const category = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) }
    });
    
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    if (category.subCategory.includes(subcategoryName)) {
      return res.status(400).json({ message: "Subcategory already exists in this category" });
    }
    
    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(categoryId) },
      data: {
        subCategory: {
          push: subcategoryName
        }
      }
    });
    
    res.status(201).json({ message: "Subcategory added successfully", category: updatedCategory });
  } catch (error) {
    console.error("Error adding subcategory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update a subcategory
app.put("/admin/update-subsection", adminAuth, async (req, res) => {
  const { categoryId, oldSubcategoryName, newSubcategoryName } = req.body;
  
  try {
    // Check if the category exists
    const category = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) }
    });
    
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    if (!category.subCategory.includes(oldSubcategoryName)) {
      return res.status(404).json({ message: "Subcategory not found" });
    }
    
    if (category.subCategory.includes(newSubcategoryName) && oldSubcategoryName !== newSubcategoryName) {
      return res.status(400).json({ message: "Subcategory name already exists in this category" });
    }
    
    const updatedSubcategories = category.subCategory.map(sub => 
      sub === oldSubcategoryName ? newSubcategoryName : sub
    );
    
    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(categoryId) },
      data: {
        subCategory: updatedSubcategories
      }
    });
    
    res.status(200).json({ message: "Subcategory updated successfully", category: updatedCategory });
  } catch (error) {
    console.error("Error updating subcategory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.delete("/admin/delete-subsection", adminAuth, async (req, res) => {
  const { categoryId, subcategoryName } = req.body;
  
  try {
    const category = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) }
    });
    
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    if (!category.subCategory.includes(subcategoryName)) {
      return res.status(404).json({ message: "Subcategory not found" });
    }
    
    const updatedSubcategories = category.subCategory.filter(sub => sub !== subcategoryName);
    
    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(categoryId) },
      data: {
        subCategory: updatedSubcategories
      }
    });
    
    res.status(200).json({ message: "Subcategory deleted successfully", category: updatedCategory });
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// Get all categories (includes categories, occasions, and recipients)
app.get("/admin/get-categories", adminAuth, async (req, res) => {
  try {
    const categories = await prisma.allCategories.findMany();
    res.status(200).json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get('/admin/get-category', adminAuth, async(req,res) => {
  try {
    const categories = await prisma.categories.findMany();
    res.status(200).json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
})

// Add a new category
app.post("/admin/add-category", adminAuth, async (req, res) => {
  const { categories, subCategories = [] } = req.body;
  
  try {
    // Check if category already exists
    const existingCategory = await prisma.categories.findFirst({
      where: { categories: { equals: categories, mode: 'insensitive' } }
    });
    
    if (existingCategory) {
      return res.status(400).json({ message: "Category already exists" });
    }
    
    const newCategory = await prisma.categories.create({
      data: {
        categories,
        subCategories
      }
    });
    
    res.status(201).json({ message: "Category added successfully", category: newCategory });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update a category
app.put("/admin/update-category/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  const { categories, subCategories } = req.body;
  
  try {
    // Check if the category exists
    const existingCategory = await prisma.categories.findUnique({
      where: { id: parseInt(categoryId) }
    });
    
    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    // Check if the new name already exists (excluding the current category)
    if (categories) {
      const nameExists = await prisma.categories.findFirst({
        where: {
          categories: { equals: categories, mode: 'insensitive' },
          id: { not: parseInt(categoryId) }
        }
      });
      
      if (nameExists) {
        return res.status(400).json({ message: "Category name already exists" });
      }
    }
    
    // Prepare update data
    const updateData = {};
    if (categories) updateData.categories = categories;
    if (subCategories) updateData.subCategories = subCategories;
    
    const updatedCategory = await prisma.categories.update({
      where: { id: parseInt(categoryId) },
      data: updateData
    });
    
    res.status(200).json({ message: "Category updated successfully", category: updatedCategory });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete a category
app.delete("/admin/delete-category/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  
  try {
    // Check if the category exists
    const existingCategory = await prisma.categories.findUnique({
      where: { id: parseInt(categoryId) }
    });
    
    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    // Delete the category
    await prisma.categories.delete({
      where: { id: parseInt(categoryId) }
    });
    
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// app.get("/admin/get-categories", adminAuth, async (req, res) => {
//   try {
//     const occasions = await prisma.allCategories.findMany();
//     res.status(200).json({ occasions });
//   } catch (error) {
//     console.error("Error fetching categories:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

app.get('/admin/get-occasion', adminAuth, async(req,res) => {
  try {
    const occasions = await prisma.occasions.findMany();
    res.status(200).json({ occasions });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
})

app.post("/admin/add-occasion", adminAuth, async (req, res) => {
  const { occasions } = req.body;
  
  try {
    const existingOccasion = await prisma.occasions.findFirst({
      where: { occasions: { equals: occasions, mode: 'insensitive' } }
    });
    
    if (existingOccasion) {
      return res.status(400).json({ message: "Occasion already exists" });
    }
    
    const newOccasion = await prisma.occasions.create({
      data: {
        occasions
      }
    });
    
    res.status(201).json({ message: "Category added successfully", category: newOccasion });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.put("/admin/update-occasion/:occasionId", adminAuth, async (req, res) => {
  const { occasionId } = req.params;
  const { occasions } = req.body;
  
  try {
    const existingOccasion = await prisma.occasions.findUnique({
      where: { id: parseInt(occasionId) }
    });
    
    if (!existingOccasion) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    if (occasions) {
      const nameExists = await prisma.occasions.findFirst({
        where: {
          occasions: { equals: occasions, mode: 'insensitive' },
          id: { not: parseInt(occasionId) }
        }
      });
      
      if (nameExists) {
        return res.status(400).json({ message: "Occasion name already exists" });
      }
    }
    
    const updateData = {};
    if (occasions) updateData.occasions = occasions;
    
    const updatedOccasion = await prisma.occasions.update({
      where: { id: parseInt(occasionId) },
      data: updateData
    });
    
    res.status(200).json({ message: "Category updated successfully", occasion: updatedOccasion });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.delete("/admin/delete-occasion/:occasionId", adminAuth, async (req, res) => {
  const { occasionId } = req.params;
  
  try {
    const existingOccasion = await prisma.occasions.findUnique({
      where: { id: parseInt(occasionId) }
    });
    
    if (!existingOccasion) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    await prisma.occasions.delete({
      where: { id: parseInt(occasionId) }
    });
    
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get('/admin/get-recipient', adminAuth, async(req,res) => {
  try {
    const recipients = await prisma.recipients.findMany();
    res.status(200).json({ recipients });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
})

app.post("/admin/add-recipient", adminAuth, async (req, res) => {
  const { recipients } = req.body;
  
  try {
    const existingRecipient = await prisma.recipients.findFirst({
      where: { recipients: { equals: recipients, mode: 'insensitive' } }
    });
    
    if (existingRecipient) {
      return res.status(400).json({ message: "Recipient already exists" });
    }
    
    const newRecipient = await prisma.recipients.create({
      data: {
        recipients
      }
    });
    
    res.status(201).json({ message: "Recipient added successfully", recipient: newRecipient });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.put("/admin/update-recipient/:recipientId", adminAuth, async (req, res) => {
  const { recipientId } = req.params;
  const { recipients } = req.body;
  
  try {
    const existingRecipient = await prisma.recipients.findUnique({
      where: { id: parseInt(recipientId) }
    });
    
    if (!existingRecipient) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    if (recipients) {
      const nameExists = await prisma.recipients.findFirst({
        where: {
          recipients: { equals: recipients, mode: 'insensitive' },
          id: { not: parseInt(recipientId) }
        }
      });
      
      if (nameExists) {
        return res.status(400).json({ message: "Recipients name already exists" });
      }
    }
    
    const updateData = {};
    if (recipients) updateData.recipients = recipients;
    
    const updatedRecipient = await prisma.recipients.update({
      where: { id: parseInt(recipientId) },
      data: updateData
    });
    
    res.status(200).json({ message: "Recipient updated successfully", recipient: updatedRecipient });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.delete("/admin/delete-recipient/:recipientId", adminAuth, async (req, res) => {
  const { recipientId } = req.params;
  
  try {
    const existingRecipients = await prisma.recipients.findUnique({
      where: { id: parseInt(recipientId) }
    });
    
    if (!existingRecipients) {
      return res.status(404).json({ message: "Recipient not found" });
    }
    
    await prisma.recipients.delete({
      where: { id: parseInt(recipientId) }
    });
    
    res.status(200).json({ message: "Recipient deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/admin/add-subcategory/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  const { subcategory } = req.body;
  
  if (!subcategory) {
    return res.status(400).json({ message: "Subcategory name is required" });
  }
  
  try {
    const category = await prisma.categories.findUnique({
      where: { id: parseInt(categoryId) }
    });
    
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (category.subCategories.includes(subcategory)) {
      return res.status(400).json({ message: "Subcategory already exists in this category" });
    }
    
    // Add the subcategory
    const updatedCategory = await prisma.categories.update({
      where: { id: parseInt(categoryId) },
      data: {
        subCategories: {
          push: subcategory
        }
      }
    });
    
    res.status(201).json({ message: "Subcategory added successfully", category: updatedCategory });
  } catch (error) {
    console.error("Error adding subcategory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete a subcategory from a category
app.delete("/admin/delete-subcategory/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  const { subcategory } = req.body;
  
  if (!subcategory) {
    return res.status(400).json({ message: "Subcategory name is required" });
  }
  
  try {
    // Check if the category exists
    const category = await prisma.categories.findUnique({
      where: { id: parseInt(categoryId) }
    });
    
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    if (!category.subCategories.includes(subcategory)) {
      return res.status(404).json({ message: "Subcategory not found in this category" });
    }
    
    const updatedSubcategories = category.subCategories.filter(sub => sub !== subcategory);
    
    const updatedCategory = await prisma.categories.update({
      where: { id: parseInt(categoryId) },
      data: {
        subCategories: updatedSubcategories
      }
    });
    
    res.status(200).json({ message: "Subcategory deleted successfully", category: updatedCategory });
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Add a new item to any of the arrays (categories, occasions, or recipients)
app.post("/admin/add-category", adminAuth, async (req, res) => {
  const { type, name } = req.body;
  
  if (!type || !name) {
    return res.status(400).json({ message: "Type and name are required" });
  }
  
  // Validate type value
  if (!['categories', 'occasions', 'recipients'].includes(type)) {
    return res.status(400).json({ message: "Invalid type. Must be 'categories', 'occasions', or 'recipients'" });
  }
  
  try {
    // Get the current categories document
    const categoriesDoc = await prisma.allCategories.findFirst();
    
    if (!categoriesDoc) {
      // If no document exists, create a new one with the item in the appropriate array
      const newData = {
        categories: type === 'categories' ? [name] : [],
        occasions: type === 'occasions' ? [name] : [],
        recipients: type === 'recipients' ? [name] : []
      };
      
      const newCategoriesDoc = await prisma.allCategories.create({
        data: newData
      });
      
      return res.status(201).json({ 
        message: `${type.slice(0, -1)} added successfully`, 
        categories: newCategoriesDoc 
      });
    }
    
    // Check if the item already exists in the specified array
    if (categoriesDoc[type] && categoriesDoc[type].includes(name)) {
      return res.status(400).json({ message: `${name} already exists in ${type}` });
    }
    
    // Add the new item to the specified array
    const updatedArray = [...(categoriesDoc[type] || []), name];
    
    // Update the document with the new array
    const updatedDoc = await prisma.allCategories.update({
      where: { id: categoriesDoc.id },
      data: { [type]: updatedArray }
    });
    
    res.status(201).json({ 
      message: `${type.slice(0, -1)} added successfully`, 
      categories: updatedDoc
    });
  } catch (error) {
    console.error(`Error adding ${type}:`, error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update an item in any of the arrays
app.put("/admin/update-category/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  const { type, category, oldName, newName } = req.body;
  
  if (!type || (!category && (!oldName || !newName))) {
    return res.status(400).json({ message: "Missing required parameters" });
  }
  
  // Validate type value
  if (!['categories', 'occasions', 'recipients'].includes(type)) {
    return res.status(400).json({ message: "Invalid type. Must be 'categories', 'occasions', or 'recipients'" });
  }
  
  try {
    // Get the current categories document
    const categoriesDoc = await prisma.allCategories.findUnique({
      where: { id: parseInt(categoryId) }
    });
    
    if (!categoriesDoc) {
      return res.status(404).json({ message: "Categories document not found" });
    }
    
    // For backward compatibility, handle both old and new parameter styles
    const itemToUpdate = oldName || category;
    const updatedName = newName || category;
    
    // Check if the item exists in the specified array
    if (!categoriesDoc[type] || !categoriesDoc[type].includes(itemToUpdate)) {
      return res.status(404).json({ message: `${itemToUpdate} not found in ${type}` });
    }
    
    // Check if the new name already exists (only if it's different from the old name)
    if (itemToUpdate !== updatedName && categoriesDoc[type].includes(updatedName)) {
      return res.status(400).json({ message: `${updatedName} already exists in ${type}` });
    }
    
    // Update the item in the array
    const updatedArray = categoriesDoc[type].map(item => 
      item === itemToUpdate ? updatedName : item
    );
    
    // Update the document with the modified array
    const updatedDoc = await prisma.allCategories.update({
      where: { id: parseInt(categoryId) },
      data: { [type]: updatedArray }
    });
    
    res.status(200).json({ 
      message: `${type.slice(0, -1)} updated successfully`, 
      categories: updatedDoc 
    });
  } catch (error) {
    console.error(`Error updating ${type}:`, error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete an item from any of the arrays
app.delete("/admin/delete-category/:categoryId", adminAuth, async (req, res) => {
  const { categoryId } = req.params;
  const { type, name } = req.body;
  
  if (!type || !name) {
    return res.status(400).json({ message: "Type and name are required" });
  }
  
  // Validate type value
  if (!['categories', 'occasions', 'recipients'].includes(type)) {
    return res.status(400).json({ message: "Invalid type. Must be 'categories', 'occasions', or 'recipients'" });
  }
  
  try {
    // Get the current categories document
    const categoriesDoc = await prisma.allCategories.findUnique({
      where: { id: parseInt(categoryId) }
    });
    
    if (!categoriesDoc) {
      return res.status(404).json({ message: "Categories document not found" });
    }
    
    // Check if the item exists in the specified array
    if (!categoriesDoc[type] || !categoriesDoc[type].includes(name)) {
      return res.status(404).json({ message: `${name} not found in ${type}` });
    }
    
    // Remove the item from the array
    const updatedArray = categoriesDoc[type].filter(item => item !== name);
    
    // Update the document with the modified array
    const updatedDoc = await prisma.allCategories.update({
      where: { id: parseInt(categoryId) },
      data: { [type]: updatedArray }
    });
    
    res.status(200).json({ 
      message: `${type.slice(0, -1)} deleted successfully`, 
      categories: updatedDoc 
    });
  } catch (error) {
    console.error(`Error deleting ${type}:`, error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Alternative delete endpoint that supports ID-based deletion for compatibility with frontend
app.delete("/admin/delete-category-by-id/:itemId", adminAuth, async (req, res) => {
  const { itemId } = req.params;
  const { type } = req.query;
  
  if (!type) {
    return res.status(400).json({ message: "Type parameter is required" });
  }
  
  // Validate type value
  if (!['categories', 'occasions', 'recipients'].includes(type)) {
    return res.status(400).json({ message: "Invalid type. Must be 'categories', 'occasions', or 'recipients'" });
  }
  
  try {
    // Parse the item ID to extract the index
    // Assuming format like "cat-0", "occ-1", "rec-2"
    const parts = itemId.split('-');
    if (parts.length !== 2) {
      return res.status(400).json({ message: "Invalid item ID format" });
    }
    
    const index = parseInt(parts[1]);
    if (isNaN(index)) {
      return res.status(400).json({ message: "Invalid item ID format" });
    }
    
    // Get the current categories document
    const categoriesDoc = await prisma.allCategories.findFirst();
    
    if (!categoriesDoc) {
      return res.status(404).json({ message: "Categories document not found" });
    }
    
    // Check if the index is valid
    if (!categoriesDoc[type] || index >= categoriesDoc[type].length) {
      return res.status(404).json({ message: `Item at index ${index} not found in ${type}` });
    }
    
    // Get the item name to be deleted
    const itemName = categoriesDoc[type][index];
    
    // Remove the item from the array
    const updatedArray = categoriesDoc[type].filter((_, i) => i !== index);
    
    // Update the document with the modified array
    const updatedDoc = await prisma.allCategories.update({
      where: { id: categoriesDoc.id },
      data: { [type]: updatedArray }
    });
    
    res.status(200).json({ 
      message: `${type.slice(0, -1)} '${itemName}' deleted successfully`, 
      categories: updatedDoc 
    });
  } catch (error) {
    console.error(`Error deleting from ${type}:`, error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.use(adminAuth);

// Get Home Page Data - Updated for new schema
app.get("/admin/home", adminAuth, async (req, res) => {
  try {
    const homeData = await prisma.homeImages.findFirst({
      include: {
        customSections: true
      }
    });
    
    if (!homeData) {
      return res.status(404).json({ message: "Homepage data not found" });
    }
    
    // Transform the data to match the frontend state structure
    const formattedHomeData = {
      heroBanner: {
        images: homeData.heroImages,
        titles: homeData.heroTitles,
        subtitles: homeData.heroSubtitles
      },
      flashSale: {
        description: homeData.flashSaleDescription,
        enabled: homeData.flashSaleEnabled
      },
      advert: {
        images: homeData.advertImages
      },
      customSections: homeData.customSections.map(section => ({
        category: section.category,
        title: section.title,
        enabled: section.enabled
      }))
    };
    
    // Get occasions data separately
    const occasionsData = await prisma.occasion.findFirst();
    if (occasionsData) {
      formattedHomeData.occasions = {
        occasionName: occasionsData.occasionName,
        occasionImages: occasionsData.occasionImages
      };
    } else {
      formattedHomeData.occasions = {
        occasionName: [],
        occasionImages: []
      };
    }
    
    res.status(200).json(formattedHomeData);
  } catch (error) {
    console.error("Error fetching homepage data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update Home Page Data - Updated for new schema
app.post("/admin/home", adminAuth, async (req, res) => {
  const { heroBanner, flashSale, advert, occasions, customSections } = req.body;

  try {
    let homeData = await prisma.homeImages.findFirst();
    
    if (homeData) {
      homeData = await prisma.homeImages.update({
        where: { id: homeData.id },
        data: {
          heroImages: heroBanner.images,
          heroTitles: heroBanner.titles,
          heroSubtitles: heroBanner.subtitles,
          flashSaleEnabled: flashSale.enabled,
          flashSaleDescription: flashSale.description,
          advertImages: advert.images,
          customSections: {
            deleteMany: {}
          }
        },
        include: {
          customSections: true
        }
      });
      
      if (customSections && customSections.length > 0) {
        for (const section of customSections) {
          await prisma.customSection.create({
            data: {
              homeImagesId: homeData.id,
              category: section.category,
              title: section.title,
              enabled: section.enabled
            }
          });
        }
      }
    } else {
      homeData = await prisma.homeImages.create({
        data: {
          heroImages: heroBanner.images,
          heroTitles: heroBanner.titles,
          heroSubtitles: heroBanner.subtitles,
          flashSaleEnabled: flashSale.enabled,
          flashSaleDescription: flashSale.description,
          advertImages: advert.images
        }
      });
      
      // Add custom sections
      if (customSections && customSections.length > 0) {
        for (const section of customSections) {
          await prisma.customSection.create({
            data: {
              homeImagesId: homeData.id,
              category: section.category,
              title: section.title,
              enabled: section.enabled
            }
          });
        }
      }
    }
    
    if (occasions) {
      const occasionData = await prisma.occasion.findFirst();
      
      if (occasionData) {
        await prisma.occasion.update({
          where: { id: occasionData.id },
          data: {
            occasionName: occasions.occasionName,
            occasionImages: occasions.occasionImages
          }
        });
      } else {
        await prisma.occasion.create({
          data: {
            occasionName: occasions.occasionName,
            occasionImages: occasions.occasionImages
          }
        });
      }
    }
    
    // Fetch the updated home data with custom sections
    const updatedHomeData = await prisma.homeImages.findFirst({
      include: {
        customSections: true
      }
    });
    
    res.status(200).json({ 
      message: "Homepage data saved successfully", 
      data: updatedHomeData
    });
  } catch (error) {
    console.error("Error saving homepage data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/admin/upload-s3-image", adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const fileUrl = await uploadFileToS3(req.file.buffer, req.file.originalname, req.file.mimetype);

    res.json({ message: "File uploaded successfully", url: fileUrl });
  } catch (error) {
      res.status(500).json({ error: "File upload failed", details: error.message });
  }
});

app.get("/admin/flash-sales", async (req, res) => {
  try {
    const flashSales = await prisma.flashSale.findMany({
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            salePrice: true,
            discount: true,
            product: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedSales = flashSales.map(sale => ({
      ...sale,
      items: sale.items.map(item => ({
        ...item,
        productName: item.product.name
      }))
    }));

    res.json(formattedSales);
  } catch (error) {
    console.error('Error fetching flash sales:', error);
    res.status(500).json({ error: 'Failed to fetch flash sales' });
  }
});

app.post("/admin/flash-sales", async (req, res) => {
  const { title, description, startTime, endTime, items } = req.body;

  try {
    const flashSale = await prisma.flashSale.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            salePrice: item.salePrice,
            discount: item.discount,
          })),
        },
      },
      include: { items: true },
    });

    res.status(201).json({ message: "Flash sale created successfully", flashSale });
  } catch (error) {
    console.error("Error creating flash sale:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/admin/flash-sales/:id", adminAuth, async(req,res) => {
  try {
    const { id } = req.params;
    
    const flashSale = await prisma.flashSale.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                price: true,
                images: true
              }
            }
          }
        }
      }
    });

    if (!flashSale) {
      return res.status(404).json({ error: 'Flash sale not found' });
    }

    res.json(flashSale);
  } catch (error) {
    console.error('Error fetching flash sale:', error);
    res.status(500).json({ error: 'Failed to fetch flash sale' });
  }
})

app.put('/admin/flash-sales/:id', async(req,res) => {
  try {
    const { id } = req.params;
    const { title, description, startTime, endTime, items } = req.body;

    if (!title || !startTime || !endTime || !items) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updatedFlashSale = await prisma.$transaction(async (prisma) => {
      await prisma.flashSaleItem.deleteMany({
        where: {
          flashSaleId: parseInt(id)
        }
      });

      const flashSale = await prisma.flashSale.update({
        where: { id: parseInt(id) },
        data: {
          title,
          description,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          items: {
            create: items.map(item => ({
              productId: item.productId,
              salePrice: item.salePrice,
              discount: item.discount
            }))
          }
        },
        include: {
          items: true
        }
      });

      return flashSale;
    });

    res.json(updatedFlashSale);
  } catch (error) {
    console.error('Error updating flash sale:', error);
    res.status(500).json({ error: 'Failed to update flash sale' });
  }
})

app.patch('/admin/flash-sales/:id/toggle', async(req,res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    const updatedFlashSale = await prisma.flashSale.update({
      where: { id: parseInt(id) },
      data: { active }
    });

    res.json(updatedFlashSale);
  } catch (error) {
    console.error('Error toggling flash sale status:', error);
    res.status(500).json({ error: 'Failed to update flash sale status' });
  }
})

app.delete('/admin/flash-sales/:id', async(req,res) => {
  try {
    const { id } = req.params;

    await prisma.flashSale.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Flash sale deleted successfully' });
  } catch (error) {
    console.error('Error deleting flash sale:', error);
    res.status(500).json({ error: 'Failed to delete flash sale' });
  }
})


app.get('/admin/orders', adminAuth, async(req,res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const search = req.query.search || "";
    
    const skip = (page - 1) * limit;
    
    let whereCondition = {};
    
    if (status && status !== 'ALL') {
      whereCondition.status = status;
    }
    
    if (search) {
      whereCondition.OR = [
        { razorpayOrderId: { contains: search, mode: 'insensitive' } },
        { user: { 
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }}
      ];
    }
    
    const totalOrders = await prisma.order.count({
      where: whereCondition
    });
    
    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });
    
    const totalPages = Math.ceil(totalOrders / limit);
    
    res.json({
      orders,
      currentPage: page,
      totalPages,
      totalOrders
    });
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
})

app.get('/admin/orders/:id', adminAuth, async(req,res) => {
  try {
    const orderId = parseInt(req.params.id);
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                discount: true,
                discountedPrice: true,
                images: {
                  select: {
                    displayImage: true
                  },
                  take: 1
                }
              }
            }
          }
        },
        shippingAddress: true
      }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
    
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
})

app.put('/admin/orders/:id/status', adminAuth, async(req,res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!['INITIATED', 'PAID', 'FAILED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // If cancelling an order that was previously paid, refund to wallet
    if (status === 'CANCELLED' && order.status === 'PAID') {
      // First, create or update user's wallet
      const wallet = await prisma.wallet.upsert({
        where: { userId: order.userId },
        update: {
          balance: {
            increment: order.amount
          }
        },
        create: {
          userId: order.userId,
          balance: order.amount
        }
      });
      
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          amount: order.amount,
          type: 'CREDIT',
          description: `Refund for cancelled order #${orderId}`
        }
      });
    }
    
    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status }
    });
    
    res.json(updatedOrder);
    
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
})

app.put('/admin/orders/:id/delivery', async(req,res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { delivery } = req.body;
    
    if (!['Ordered', 'Shipped', 'Delivered', 'Cancelled'].includes(delivery)) {
      return res.status(400).json({ error: 'Invalid delivery status value' });
    }
    
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { delivery }
    });
    
    res.json(updatedOrder);
    
  } catch (error) {
    console.error('Error updating delivery status:', error);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
})

app.get('admin/orders/stats/summary', async(req,res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { delivery } = req.body;
    
    if (!['Ordered', 'Shipped', 'Delivered', 'Cancelled'].includes(delivery)) {
      return res.status(400).json({ error: 'Invalid delivery status value' });
    }
    
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { delivery }
    });
    
    res.json(updatedOrder);
    
  } catch (error) {
    console.error('Error updating delivery status:', error);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
})

const validateCouponDates = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, message: 'Invalid date format' };
  }
  
  if (end < start) {
    return { valid: false, message: 'End date must be after start date' };
  }
  
  return { valid: true };
};

app.get('/admin/coupons', adminAuth, async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Format the data for the frontend
    const formattedCoupons = coupons.map(coupon => ({
      ...coupon,
      discountValue: parseFloat(coupon.discountValue),
      minPurchaseAmount: coupon.minPurchaseAmount ? parseFloat(coupon.minPurchaseAmount) : null,
      maxDiscountAmount: coupon.maxDiscountAmount ? parseFloat(coupon.maxDiscountAmount) : null,
    }));
    
    res.json(formattedCoupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

// CREATE a new coupon
app.post('/admin/coupons', adminAuth, async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      isActive,
      usageLimit,
      perUserLimit,
      applicableUserIds,
      applicableProductIds,
      applicableCategories,
      applicableOccasions,
      applicableRecipients
    } = req.body;

    // Validate required fields
    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Validate code format (uppercase letters and numbers only)
    if (!/^[A-Z0-9]+$/.test(code)) {
      return res.status(400).json({ error: 'Coupon code must contain only uppercase letters and numbers' });
    }

    // Check if code already exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code }
    });

    if (existingCoupon) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    // Validate dates
    const dateValidation = validateCouponDates(startDate, endDate);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.message });
    }

    // Validate discount value
    if (discountType === 'PERCENTAGE' && (discountValue <= 0 || discountValue > 100)) {
      return res.status(400).json({ error: 'Percentage discount must be between 0 and 100' });
    }

    if (discountType === 'FIXED' && discountValue <= 0) {
      return res.status(400).json({ error: 'Fixed discount must be greater than 0' });
    }

    // Create the coupon
    const newCoupon = await prisma.coupon.create({
      data: {
        code,
        description,
        discountType,
        discountValue,
        minPurchaseAmount: minPurchaseAmount || null,
        maxDiscountAmount: maxDiscountAmount || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive,
        usageLimit: usageLimit || null,
        perUserLimit: perUserLimit || null,
        applicableUserIds: applicableUserIds || [],
        applicableProductIds: applicableProductIds || [],
        applicableCategories: applicableCategories || [],
        applicableOccasions: applicableOccasions || [],
        applicableRecipients: applicableRecipients || []
      }
    });

    res.status(201).json(newCoupon);
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

// UPDATE an existing coupon
app.put('/admin/coupons/:id', adminAuth, async (req, res) => {
  try {
    const couponId = parseInt(req.params.id);
    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      isActive,
      usageLimit,
      perUserLimit,
      applicableUserIds,
      applicableProductIds,
      applicableCategories,
      applicableOccasions,
      applicableRecipients
    } = req.body;

    // Validate required fields
    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Validate code format
    if (!/^[A-Z0-9]+$/.test(code)) {
      return res.status(400).json({ error: 'Coupon code must contain only uppercase letters and numbers' });
    }

    // Check if coupon exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId }
    });

    if (!existingCoupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    // Check if updated code already exists (ignore if it's the same coupon)
    if (code !== existingCoupon.code) {
      const codeExists = await prisma.coupon.findUnique({
        where: { code }
      });

      if (codeExists) {
        return res.status(400).json({ error: 'Coupon code already exists' });
      }
    }

    // Validate dates
    const dateValidation = validateCouponDates(startDate, endDate);
    if (!dateValidation.valid) {
      return res.status(400).json({ error: dateValidation.message });
    }

    // Validate discount value
    if (discountType === 'PERCENTAGE' && (discountValue <= 0 || discountValue > 100)) {
      return res.status(400).json({ error: 'Percentage discount must be between 0 and 100' });
    }

    if (discountType === 'FIXED' && discountValue <= 0) {
      return res.status(400).json({ error: 'Fixed discount must be greater than 0' });
    }

    // Update the coupon
    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        code,
        description,
        discountType,
        discountValue,
        minPurchaseAmount: minPurchaseAmount || null,
        maxDiscountAmount: maxDiscountAmount || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive,
        usageLimit: usageLimit || null,
        perUserLimit: perUserLimit || null,
        applicableUserIds: applicableUserIds || [],
        applicableProductIds: applicableProductIds || [],
        applicableCategories: applicableCategories || [],
        applicableOccasions: applicableOccasions || [],
        applicableRecipients: applicableRecipients || []
      }
    });

    res.json(updatedCoupon);
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

// DELETE a coupon
app.delete('/admin/coupons/:id', adminAuth, async (req, res) => {
  try {
    const couponId = parseInt(req.params.id);
    
    // Check if coupon exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: { usages: true }
    });

    if (!existingCoupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    // Delete the coupon
    await prisma.coupon.delete({
      where: { id: couponId }
    });

    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

// Get all users (for coupon targeting)
app.get('/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      },
      orderBy: {
        firstName: 'asc'
      }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/admin/products', adminAuth, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        price: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    const formattedProducts = products.map(product => ({
      ...product,
      price: parseFloat(product.price)
    }));
    
    res.json(formattedProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/admin/categories', adminAuth, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        category: true
      },
      orderBy: {
        category: 'asc'
      }
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get all occasions (for coupon targeting)
app.get('/admin/occasions', adminAuth, async (req, res) => {
  try {
    const occasions = await prisma.occasions.findMany({
      select: {
        id: true,
        occasions: true
      },
      orderBy: {
        occasions: 'asc'
      }
    });
    res.json(occasions);
  } catch (error) {
    console.error('Error fetching occasions:', error);
    res.status(500).json({ error: 'Failed to fetch occasions' });
  }
});

// Get all recipients (for coupon targeting)
app.get('/admin/recipients', adminAuth, async (req, res) => {
  try {
    const recipients = await prisma.recipients.findMany({
      select: {
        id: true,
        recipients: true
      },
      orderBy: {
        recipients: 'asc'
      }
    });
    res.json(recipients);
  } catch (error) {
    console.error('Error fetching recipients:', error);
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

// Validate a coupon (for customer checkout)
app.post('/validate-coupon', async (req, res) => {
  try {
    const { code, userId, cartItems, totalAmount } = req.body;
    
    if (!code || !userId || !cartItems || !totalAmount) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    // Find the coupon by code
    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: {
        usages: {
          where: { userId: parseInt(userId) }
        }
      }
    });
    
    // Check if coupon exists
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    
    // Check if coupon is active
    if (!coupon.isActive) {
      return res.status(400).json({ error: 'Coupon is not active' });
    }
    
    // Check if coupon is expired
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      return res.status(400).json({ error: 'Coupon is expired or not yet valid' });
    }
    
    // Check usage limits
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ error: 'Coupon usage limit exceeded' });
    }
    
    // Check per-user limits
    if (coupon.perUserLimit && coupon.usages.length >= coupon.perUserLimit) {
      return res.status(400).json({ error: 'You have already used this coupon the maximum number of times' });
    }
    
    // Check minimum purchase amount
    if (coupon.minPurchaseAmount && totalAmount < parseFloat(coupon.minPurchaseAmount)) {
      return res.status(400).json({ 
        error: `Minimum purchase amount of ₹${parseFloat(coupon.minPurchaseAmount)} not met` 
      });
    }
    
    // Check user restrictions
    if (coupon.applicableUserIds.length > 0 && !coupon.applicableUserIds.includes(parseInt(userId))) {
      return res.status(400).json({ error: 'Coupon is not applicable for your account' });
    }
    
    // Check product restrictions
    if (coupon.applicableProductIds.length > 0) {
      const cartProductIds = cartItems.map(item => item.productId);
      const hasApplicableProduct = cartProductIds.some(id => 
        coupon.applicableProductIds.includes(parseInt(id))
      );
      
      if (!hasApplicableProduct) {
        return res.status(400).json({ error: 'Coupon is not applicable for the products in your cart' });
      }
    }
    
    // Calculate discount amount
    let discountAmount = 0;
    
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = totalAmount * (parseFloat(coupon.discountValue) / 100);
      
      // Apply maximum discount cap if applicable
      if (coupon.maxDiscountAmount && discountAmount > parseFloat(coupon.maxDiscountAmount)) {
        discountAmount = parseFloat(coupon.maxDiscountAmount);
      }
    } else { // FIXED discount
      discountAmount = parseFloat(coupon.discountValue);
      
      // Discount cannot be greater than the total amount
      if (discountAmount > totalAmount) {
        discountAmount = totalAmount;
      }
    }
    
    // Round to 2 decimal places
    discountAmount = Math.round(discountAmount * 100) / 100;
    
    // Respond with the coupon details and calculated discount
    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: parseFloat(coupon.discountValue)
      },
      discountAmount,
      finalAmount: totalAmount - discountAmount
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// Apply a coupon to an order (to be called during checkout)
app.post('/apply-coupon', async (req, res) => {
  try {
    const { couponId, userId, orderId } = req.body;
    
    if (!couponId || !userId || !orderId) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    
    // Find the coupon
    const coupon = await prisma.coupon.findUnique({
      where: { id: parseInt(couponId) }
    });
    
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    
    // Record the coupon usage
    await prisma.couponUsage.create({
      data: {
        couponId: parseInt(couponId),
        userId: parseInt(userId),
        orderId: parseInt(orderId)
      }
    });
    
    // Increment the usage count
    await prisma.coupon.update({
      where: { id: parseInt(couponId) },
      data: {
        usageCount: {
          increment: 1
        }
      }
    });
    
    res.json({ message: 'Coupon applied successfully' });
  } catch (error) {
    console.error('Error applying coupon:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'This coupon has already been applied to this order' });
    }
    
    res.status(500).json({ error: 'Failed to apply coupon' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});