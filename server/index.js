const express = require("express");
var http = require("http");
const app = express();
const port = process.env.PORT || 5000;
var server = http.createServer(app);
var io = require("socket.io")(server);
const mongoose = require("mongoose");
const getWord = require("./apis/generateWord");
const Room = require("./models/Room");

//middleware
app.use(express.json());

mongoose
  .connect(
    "mongodb+srv://rivaan:rivaanranawat@cluster0.xbhhc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
    }
  )
  .then(() => {
    console.log("connection succesful");
  })
  .catch((e) => {
    console.log(e);
  });

// sockets

io.on("connection", (socket) => {
  console.log("connected");
  console.log(socket.id, "has joined");
  socket.on("test", (data) => {
    console.log(data);
  });

  // white board related sockets
  socket.on("paint", ({ details, roomName }) => {
    console.log(details);
    console.log(roomName);
    io.to(roomName).emit("points", { details: details });
  });

  socket.on("clean-screen", (roomId) => {
    console.log("screen clean");
    io.to(roomId).emit("clear-screen", "");
  });

  socket.on("stroke-width", (stroke) => {
    io.emit("stroke-width", stroke);
  });

  // game related sockets
  // creating game
  socket.on("create-game", async ({ nickname, name, occupancy }) => {
    try {
      const existingRoom = await Room.findOne({ name });
      if (existingRoom) {
        socket.emit("notCorrectGame", "Room with that name already exists");
        return;
      }
      let room = new Room();
      const word = await getWord();
      room.word = word;
      room.name = name;
      room.occupancy = occupancy;
      let player = {
        socketID: socket.id,
        nickname,
        isPartyLeader: true,
      };
      room.players.push(player);
      room = await room.save();
      socket.join(name);
      io.to(name).emit("updateRoom", room);
    } catch (err) {
      console.log(err);
    }
  });

  // joining game
  socket.on("join-game", async ({ nickname, name }) => {
    console.log(name, nickname);
    try {
      let room = await Room.findOne({ name });
      if (!room) {
        socket.emit("notCorrectGame", "Please enter a valid room name");
        return;
      }
      console.log(room);
      if (room.isJoin || room.players.length < room.occupancy) {
        let player = {
          socketID: socket.id,
          nickname,
        };
        room.players.push(player);
        room = await room.save();
        socket.join(name);
        io.to(name).emit("updateRoom", room);
      } else {
        socket.emit(
          "notCorrectGame",
          "The Game is in progress, please try later!"
        );
      }
    } catch (err) {
      console.log(err.toString());
    }
  });

  // sending messages in paint screen
  socket.on("msg", (data) => {
    console.log(data.username);
    console.log(data.msg);
    if (data.msg == data.word) {
      io.to(data.roomName).emit("msg", {
        username: data.username,
        msg: "guessed it!",
      });
      // increment points algorithm
    } else {
      io.to(data.roomName).emit("msg", {
        username: data.username,
        msg: data.msg,
      });
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log("server started");
});