const ObjectId = require("mongodb").ObjectId;

const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

require("dotenv").config();
app.use(cors());
app.use(express.json());
const stripe = require("stripe")(process.env.SECREAT_KEY);
app.get("/", (req, res) => {
  res.send("Doctor portal is running");
});

const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.SITE_NAME}:${process.env.Dr_Belal_KEY}@cluster0.mlxcjcs.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});





async function run() {
  try {
    await client.connect();
    console.log("Database connect");
  } catch (error) {
    console.error(error);
  }
}
const AllAppoinmentOption = client.db("Drbelal").collection("AppoimentOptions");
const bookingAppointments = client.db("Drbelal").collection("bookingAppointments");
const users = client.db("Drbelal").collection("users");
const AddedNewDoctors = client.db("Drbelal").collection("AddedNewDoctors");
const payments = client.db("Drbelal").collection("AllPayments");


function verifyJwt(req, res, next) {
  // console.log("verify inside", req.headers.authorization);
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send("Unauthorized Access");
  }
  const token = authHeader.split(" ")[1];
  console.log(authHeader, token);
  jwt.verify(token, process.env.AccessToken, function (err, decoded) {
    if (err) {
      console.log(err);
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

app.post("/create-payment-intent", async (req, res) => {
  const booking = req.body;
  const price = booking.price;
  const amount = price * 100;

  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    payment_method_types: ["card"],
  });
  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

app.post("/payment", async (req, res) => {
  const payment = req.body;
  console.log(payment)
  const result = await payments.insertOne(payment);
  const id = payment.bookingId;
  const filter = {_id: ObjectId(id) };
  const updatedDoc = {
    $set: {
      paid: true,
      transactionId: payment.transactionId,
    },
  };
  const updateResult = await bookingAppointments.updateOne(filter, updatedDoc);
  console.log(updateResult)
  res.send(result);
});

app.listen(4242, () => console.log("Node server listening on port 4242!"));

const verifyAdmin = async (req, res, next) => {
  const decodedEmail = req.decoded.email;
  const query = { email: decodedEmail };
  const user = await users.findOne(query);

  if (user?.role !== "Admin") {
    return res.status(403).send({ message: "You're not author" });
  }
  next();
};



app.get("/allOptions", async (req, res) => {
  const date = req.query.date;
  const query = {};
  const cursor = AllAppoinmentOption.find(query);
  const allOption = await cursor.toArray();
  const bookingQuery = { appointmentDate: date };
  const booked = await bookingAppointments.find(bookingQuery).toArray();
  allOption.forEach((option) => {
    const optionBooked = booked.filter((book) => book.TreatmentName === option.name);
    const bookedSlot = optionBooked.map((book) => book.Slots);
    // console.log(option)
    // const remainingSlot = option.Slots.filter(slot=> !bookedSlot.includes(slot))
    const remainingSlot = option.slots.filter((slot) => !bookedSlot.includes(slot));
    option.slots = remainingSlot;
    // console.log(date, option.name, bookedSlot, remainingSlot.length)
  });
  // console.log(allOption)
  res.send(allOption);
});

app.get("/bookings", verifyJwt, async (req, res) => {
  const email = req.query.Email;
  const decodedEmail = req.query.Email;
  if (email !== decodedEmail) {
    return res.status(403).send({ message: "Forbidden Access" });
  }
  const query = { email: email };
  // console.log("Token", req.headers.authorization);
  const getBookingByEmail = await bookingAppointments.find(query).toArray();
  // console.log(getBookingByEmail)
  res.send(getBookingByEmail);
});

app.post("/bookings", async (req, res) => {
  const booking = req.body;

  const query = {
    appointmentDate: booking.appointmentDate,
    Email: booking.Email,
    TreatmentName: booking.TreatmentName,
  };
  //    console.log(query)
  const allReadyBooked = await bookingAppointments.find(query).toArray();
  // console.log(allReadyBooked.)
  if (allReadyBooked.length) {
    const message = `You already booked on ${booking.appointmentDate}`;
    return res.send({ acknowledged: false, message });
  }
  const ReceiveBooking = await bookingAppointments.insertOne(booking);

  // console.log(ReceiveBooking)
  res.send(ReceiveBooking);
});

app.get("/bookings/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: ObjectId(id) };
  const getSpecificId = await bookingAppointments.findOne(query);
  res.send(getSpecificId);
});

app.post("/users", async (req, res) => {
  const user = req.body;
  const saveUser = await users.insertOne(user);
  // console.log(saveUser);
  res.send(saveUser);
});
app.get("/users", async (req, res) => {
  const user = {};
  const saveUser = await users.find(user).toArray();
  // console.log(saveUser);
  res.send(saveUser);
});

app.put("/users/admin/:id", verifyJwt, async (req, res) => {
  // const decodedEmail = req.decoded.email;
  // const query = { email: decodedEmail };
  // const user = await users.findOne(query);

  // if (user?.role !== "Admin") {
  //   return res.status(403).send({ message: "You're not author" });
  // }
  const id = req.params.id;
  const filter = { _id: ObjectId(id) };
  const option = { upsert: true };
  const updateDoc = {
    $set: {
      role: "Admin",
    },
  };
  const result = await users.updateOne(filter, updateDoc, option);
  res.send(result);
});


app.get("/users/admin/:email", async (req, res) => {
  const email = req.params.email;
  const query = { email };
  const user = await users.findOne(query);
  res.send({ isAdmin: user?.role === "Admin" });
});

//JSON WEB TOKEN

app.get("/jwt", async (req, res) => {
  const email = req.query.email;
  const query = { email: email };
  const UserToken = await users.findOne(query);
  if (UserToken) {
    const token = jwt.sign({ email }, process.env.AccessToken, { expiresIn: "776h" });
    return res.send({ AccessToken: token });
  } else {
    res.status(403).send({ AccessToken: "" });
  }
});

app.get("/DoctorSpecialtyAppointment", async (req, res) => {
  const query = {};
  const specialty = await AllAppoinmentOption.find(query).project({ name: 1 }).toArray();
  // console.log(specialty);
  res.send(specialty);
});

app.post("/addedDoctor", verifyJwt, verifyAdmin, async (req, res) => {
  const doctor = req.body;
  const addDoctor = await AddedNewDoctors.insertOne(doctor);
  // console.log(addDoctor);
  res.send(addDoctor);
});

app.get("/addedDoctor", verifyJwt, verifyAdmin, async (req, res) => {
  const doctor = {};
  const receivedDoctor = await AddedNewDoctors.find(doctor).toArray();
  // console.log(receivedDoctor);
  res.send(receivedDoctor);
});

app.delete("/deleted/:id", verifyJwt, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const query = { _id: ObjectId(id) };
  console.log(id);
  const deleteDoctor = await AddedNewDoctors.deleteOne(query);
  res.send(deleteDoctor);
});

app.get("/addPrice", async (req, res) => {
  const filter = {};
  const options = { upsert: true };
  const updateDoc = {
    $set: {
      price: 600,
    },
  };
  const updatePrice = await AllAppoinmentOption.updateMany(filter, updateDoc, options);
  res.send(updatePrice);
});

run().catch((error) => console.error(error));

app.listen(port, (req, res) => {
  console.log(` doctors portal is running ${port}`);
});
