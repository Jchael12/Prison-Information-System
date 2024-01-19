const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary");
const multer = require("multer");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();

//middleware
const corsOptions = {
  origin: "*",
  credential: true,
};

//cloudinary configs
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(cors(corsOptions));
app.use(express.json());

//
app.get("/", (req, res) => {
  res.send("App is working!");
});

//connect to mongodb
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //create database collection
    const dataCollections = client.db("Detainees").collection("persons");

    //multer setup
    const storage = multer.memoryStorage();
    const upload = multer({ storage: storage });

    //insert a person info to the database: via post method
    app.post("/upload-info", upload.single("image"), async (req, res) => {
      try {
        const data = req.body;

        if (req.file) {
          // Convert buffer to Base64 string
          const imageBuffer = req.file.buffer.toString("base64");

          // Ensure unique public_id by using data._id
          const public_id = `${data._id || Date.now()}-${req.file.originalname
            .replace(/\s+/g, "_")
            .toLowerCase()}`;

          // Upload image to Cloudinary
          const imageResult = await cloudinary.uploader.upload(
            "data:image/png;base64," + imageBuffer,
            {
              folder: "images",
              public_id: public_id,
            },
          );

          console.log("Image Result: ", imageResult);

          if (imageResult.secure_url) {
            // Update data with image_url
            data.image_url = imageResult.secure_url;
          } else {
            // Handle the case where Cloudinary upload failed
            console.error("Cloudinary upload failed");
            return res.status(500).json({ error: "Cloudinary Upload Failed" });
          }
        }

        const result = await dataCollections.insertOne(data);
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    //update a person info : patch or update method
    app.patch("/person/:id", async (req, res) => {
      const id = req.params.id;
      const updatePersonInfo = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...updatePersonInfo,
        },
      };

      //update
      const result = await dataCollections.updateOne(
        filter,
        updateDoc,
        options,
      );
      res.send(result);
    });

    //get all person data from the database: via get method
    app.get("/all-data", async (req, res) => {
      const persons = dataCollections.find();
      const result = await persons.toArray();
      res.send(result);
    });

    //get one person data from the database: via get method
    app.get("/person/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const filter = { _id: new ObjectId(id) };
        const result = await dataCollections.findOne(filter);

        if (result) {
          res.send(result);
        } else {
          res.status(404).send({ message: "Person Not Found!" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    //delete a person info : delete method
    app.delete("/person/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await dataCollections.deleteOne(filter);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`App is running at port ${process.env.PORT}`);
});
