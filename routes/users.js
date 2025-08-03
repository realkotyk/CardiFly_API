const { Router } = require("express");

const router = Router();

//CRUD - Create, Read, Update, Delete
router.route("/").get((req, res) => {
    res.send("Read all users");
});

router.route("/:id").get((req, res) => {
    console.log(`Get user with ID: ${req.params.id}`);
    res.send(`Found user, with ID: ${req.params.id}`);
});

router.route("/").post((req, res) => {
    res.send("Create new User");
});

router.route("/:id").patch((req, res) => {
    res.send(`Update existing user, with ID: ${req.params.id}`);
});

router.route("/:id").delete((req, res) => {
    res.send(`Delete user, with ID: ${req.params.id}`);
});

module.exports = router;
