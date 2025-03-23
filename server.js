require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcryptjs")

const app = express();
const PORT = process.env.PORT || 5001;
const MONGO_URI_FOOD = process.env.MONGO_URI_FOOD;
const MONGO_URI_ORG = process.env.MONGO_URI_ORG;

if (!MONGO_URI_FOOD || !MONGO_URI_ORG) {
    console.error("Error: MongoDB URIs are not defined in the .env file.");
    process.exit(1);
}

const foodConnection = mongoose.createConnection(MONGO_URI_FOOD, { useUnifiedTopology: true });
foodConnection.on("connected", () => {
    console.log("Connected to Food database");
});


const orgConnection = mongoose.createConnection(MONGO_URI_ORG, { useUnifiedTopology: true });
orgConnection.on("connected", () => {
    console.log("Connected to Organisation database");
});
const dbUri = 'mongodb://localhost:27017/';

const foodSchema = new mongoose.Schema({
    foodType: String,
    quantity: Number,
    freshSpan: Number,
    name: String,
    contactNumber: Number,
    email: String,
    locationType: String,
    locationDescription: String,
    date: { type: Date, default: Date.now }
});

const organisationSchema = new mongoose.Schema({
    orgName: { type: String, required: true },
    orgType: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: Number, required: true },
    govtId: { type: String },
    password: { type: String, required: true },
});

const volunteerSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: Number, required: true },
    govtId: { type: String },
    password: { type: String, required: true }
});

const Organisation = orgConnection.model("Organisation", organisationSchema);
const Food = foodConnection.model("Food", foodSchema);
const Volunteer = orgConnection.model("Volunteer", volunteerSchema);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.render("home"));
app.get("/fr", (req, res) => res.render("fr"));
app.get("/login", (req, res) => res.render("login"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/about", (req, res) => res.render("about"));
app.get("/vsignup", (req, res) => res.render("volunteersignup"));
app.get("/osignup", (req, res) => res.render("organizationsignup"));

app.get("/dashboard", async (req, res) => {
    try {
        const foodEntries = await Food.find();
        res.render("dashboard", { foodEntries });
    } catch (err) {
        console.error("Error fetching food entries:", err);
        res.status(500).send("Error fetching data");
    }
});

app.post("/add-food", async (req, res) => {
    try {
        const newFood = new Food(req.body);
        await newFood.save();
        console.log("New Food Entry Saved:", newFood);
        res.redirect("fr");
    } catch (err) {
        console.error("Error saving food details:", err);
        res.status(500).send("Error saving food details");
    }
});

app.post("/osignup", async (req, res) => {
    try {
        const { orgName, orgType, email, mobile, govtId, password } = req.body;

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newOrganisation = new Organisation({
            orgName,
            orgType,
            email,
            mobile,
            govtId,
            password: hashedPassword // Save hashed password
        });

        await newOrganisation.save();
        console.log("New Organisation Saved:", newOrganisation);
        res.redirect("/login");

    } catch (err) {
        console.error("Error saving organisation data:", err);
        res.status(500).send("Error saving organisation data");
    }
});

app.post("/volsignup", async (req, res) => {
    try {
        const { firstName, lastName, email, mobile, govtId, password } = req.body;

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newVolunteer = new Volunteer({
            firstName,
            lastName,
            email,
            mobile,
            govtId,
            password: hashedPassword // Save hashed password
        });

        await newVolunteer.save();
        console.log("New Volunteer Saved:", newVolunteer);
        res.redirect("/login");

    } catch (err) {
        console.error("Error saving volunteer data:", err);
        res.status(500).send("Error saving volunteer data");
    }
});


app.delete("/delete-food/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await Food.findByIdAndDelete(id);
        console.log(`Food entry with ID ${id} deleted.`);
        res.json({ message: "Food deleted successfully!" });
    } catch (err) {
        console.error("Error deleting food:", err);
        res.status(500).json({ error: "Error deleting food" });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password, DBtype } = req.body;

        // Select the correct database connection
        let User;
        if (DBtype === "Organisation") {
            User = Organisation;
        } else if (DBtype === "volunteers") {
            User = Volunteer;
        } else {
            return res.status(400).json({ success: false, message: "Invalid user type" });
        }

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).send(`<script>alert("User not found!"); window.location.href='/login';</script>`);
        }

        // Compare password with hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).send(`<script>alert("Incorrect password!"); window.location.href='/login';</script>`);
        }

        console.log(`User logged in: ${email}`);

        // Redirect to the dashboard on successful login
        res.redirect("/dashboard");

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send(`<script>alert("Internal server error!"); window.location.href='/login';</script>`);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});