const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Hello from the backend container!");
});

app.listen(port, () => {
    console.log(`Backend container is running on port ${port}`);
});

module.exports = app;
