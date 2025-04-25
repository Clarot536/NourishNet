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
    acceptedFoods: [
        {
            foodType: String,
            quantity: Number,
            freshSpan: Number,
            name: String,
            contactNumber: Number,
            email: String,
            locationType: String,
            locationDescription: String,
            date: { type: Date, default: Date.now }
        }
    ]
});

const volunteerSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: Number, required: true },
    govtId: { type: String },
    password: { type: String, required: true },
    acceptedFoods: [
        {
            foodType: String,
            quantity: Number,
            freshSpan: Number,
            name: String,
            contactNumber: Number,
            email: String,
            locationType: String,
            locationDescription: String,
            date: { type: Date, default: Date.now }
        }
    ]
});

const Organisation = orgConnection.model("Organisation", organisationSchema);
const Food = foodConnection.model("Food", foodSchema);
const Volunteer = orgConnection.model("Volunteer", volunteerSchema);

const session = require("express-session");

app.use(session({
    secret: 'your-secret-key', // use env var in production
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 10 * 60 * 1000 } // 10 minutes
}));

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

app.get(["/org/:username", "/vol/:username"], async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }
    const { id, role } = req.session.user;
    let user;
    if(role==="Organisation")
        user = await Organisation.findOne({ id });
    else
        user = await Volunteer.findOne({ id });
    try {
        const foodEntries = await Food.find(); // Assuming these are unaccepted entries
 
        if (role === "Organisation") {
            const org = await Organisation.findById(id);
            return res.render("dashboard", {
                foodEntries, 
                acceptedFoodEntries: org.acceptedFoods || []
            });
        } else if (role === "volunteers") {
            const vol = await Volunteer.findById(id);
            return res.render("dashboard", {
                foodEntries, user,
                acceptedFoodEntries: vol.acceptedFoods || []
            });
        } else {
            return res.status(400).send("Invalid user type");
        }

    } catch (err) {
        console.error("Error fetching dashboard data:", err);
        res.status(500).send("Internal server error");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
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


app.post("/delete-food/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const { quantity } = req.body;
        const userSession = req.session.user;

        if (!userSession) {
            return res.status(401).json({ error: "Unauthorized: User not logged in" });
        }

        const food = await Food.findById(id);
        if (!food) {
            return res.status(404).json({ error: "Food not found" });
        }

        const acceptQuantity = Number(quantity);
        if (isNaN(acceptQuantity) || acceptQuantity <= 0) {
            return res.status(400).json({ error: "Invalid quantity" });
        }

        // Prepare accepted food object
        const acceptedFood = {
            foodType: food.foodType,
            quantity: acceptQuantity,
            freshSpan: food.freshSpan,
            name: food.name,
            contactNumber: food.contactNumber,
            email: food.email,
            locationType: food.locationType,
            locationDescription: food.locationDescription,
        };

        // Identify which model to update
        const Model = userSession.role === "Organisation" ? Organisation : Volunteer;
        const user = await Model.findById(userSession.id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        user.acceptedFoods = [acceptedFood];
        await user.save();

        if (food.quantity === acceptQuantity) {
            await Food.findByIdAndDelete(id);
            return res.json({ message: "Food fully deleted and accepted!", acceptedFood });
        } else if (food.quantity > acceptQuantity) {
            food.quantity -= acceptQuantity;
            await food.save();
            return res.json({ message: "Food quantity updated and partially accepted!", updatedFood: food, acceptedFood });
        } else {
            return res.status(400).json({ error: "Not enough quantity available to accept" });
        }
    } catch (err) {
        console.error("Error deleting or updating food:", err);
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/clear-accepted-food", async (req, res) => {
    try {
        const { id, role } = req.session.user;

        if (role === "Organisation") {
            await Organisation.findByIdAndUpdate(id, { acceptedFoods: [] });
        } else if (role === "volunteers") {
            await Volunteer.findByIdAndUpdate(id, { acceptedFoods: [] });
        } else {
            return res.status(400).json({ error: "Invalid user role" });
        }

        res.json({ message: "Accepted food cleared" });
    } catch (err) {
        console.error("Error clearing accepted food:", err);
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password, DBtype } = req.body;

        let User;
        if (DBtype === "Organisation") {
            User = Organisation;
        } else if (DBtype === "volunteers") {
            User = Volunteer;
        } else {
            return res.status(400).json({ success: false, message: "Invalid user type" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).send(`<script>alert("User not found!"); window.location.href='/login';</script>`);
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).send(`<script>alert("Incorrect password!"); window.location.href='/login';</script>`);
        }

        // ✅ Set session
        req.session.user = {
            id: user._id,
            role: DBtype,
            username: DBtype === "Organisation" ? user.orgName : user.firstName
        };

        // ✅ Redirect to role-based dashboard
        const routePrefix = DBtype === "Organisation" ? "org" : "vol";
        const username = encodeURIComponent(req.session.user.username);
        console.log("all ok");
        res.redirect(`/${routePrefix}/${username}`);

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send(`<script>alert("Internal server error!"); window.location.href='/login';</script>`);
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});