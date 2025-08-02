const express = require('express')
const app = express()
const port = 3000

//CRUD - Create, Read, Update, Delete
app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.post('/', (req, res) => {
    res.send('Create SMTH')
}); 

app.put("/", (req, res) => {
    res.send('Update SMTH')
})

app.delete("/", (req, res) => {
    res.send('Delete SMTH')
})
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
