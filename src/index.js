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

// Add a subcategory to an existing category
app.post("/admin/add-subcategory/:categoryId", adminAuth, async (req, res) => {
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
    
    // Check if subcategory already exists
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

app.get("/admin/flash-sale", async (req, res) => {
  try {
    const flashSale = await prisma.flashSale.findFirst({
      include: { items: true },
    });
    res.status(200).json(flashSale);
  } catch (error) {
    console.error("Error fetching flash sale:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/admin/flash-sale", async (req, res) => {
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});