import { Socket, Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
// import { TokenCheck } from "../../methods/TokenCheck";

const prisma = new PrismaClient();

export const QuizStartSocketListener = (socket: Socket, io: Server) => {
  socket.on("QuizStart", async (dataIO) => {
    console.log("redirecting");
    const GetQuizList: any = await prisma.room
      .findUnique({
        where: {
          room: dataIO.Roomname,
        },
        include: {
          Quiz: {
            include: {
              question: {
                include: {
                  choice: true,
                },
              },
            },
          },
        },
      })
      .catch((e) => {
        console.log(e);
      })
      .then((data) => {
        return data?.Quiz?.question;
      })
      .finally(() => {
        prisma.$disconnect();
      });
    socket.data.questionArr = GetQuizList;
    socket.data.QuestionIndex = 0;
    const DeleteExistingSession = await prisma.quizSession
      .updateMany({
        where: {
          roomName: dataIO.Roomname,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      })
      .catch((e) => {
        console.log(e);
      })
      .finally(() => {
        prisma.$disconnect();
      });
    const CreateQuizSession = await prisma.quizSession
      .create({
        data: {
          questionId: socket.data.questionArr[socket.data.QuestionIndex].id,
          roomName: dataIO.Roomname,
          isActive: true,
        },
      })
      .catch((e) => {
        console.log(e);
      })
      .finally(() => {
        prisma.$disconnect();
      });
    socket.emit("redirect", { PageName: "creator-join" });
    socket.to(dataIO.Roomname).emit("redirect", { PageName: "quiz-join" });
  });

  socket.on("next", async (dataIO) => {
    if (
      socket.data.QuestionIndex >= 0 &&
      socket.data.QuestionIndex < socket.data.questionArr.length - 1
    ) {
      socket.data.QuestionIndex++;
      const UpdateSession = await prisma.quizSession.updateMany({
        where: {
          roomName: dataIO.Roomname,
          isActive: true,
        },
        data: {
          questionId: socket.data.questionArr[socket.data.QuestionIndex].id,
        },
      });
      socket.emit("refresh");
      socket.to(dataIO.Roomname).emit("refresh");
    }
  });
  socket.on("previous", async (dataIO) => {
    if (
      socket.data.QuestionIndex > 0 &&
      socket.data.QuestionIndex < socket.data.questionArr.length
    ) {
      socket.data.QuestionIndex = socket.data.QuestionIndex - 1;
      const UpdateSession = await prisma.quizSession.updateMany({
        where: {
          roomName: dataIO.Roomname,
          isActive: true,
        },
        data: {
          questionId: socket.data.questionArr[socket.data.QuestionIndex].id,
        },
      });
      socket.emit("refresh");
      socket.to(dataIO.Roomname).emit("refresh");
    }
  });
  socket.on("QuizLoad", async (dataIO) => {
    const getQuizSession = await prisma.quizSession
      .findFirst({
        where: {
          roomName: dataIO.Roomname,
          isActive: true,
        },
        include: {
          Question: {
            include: {
              choice: {
                select: {
                  id: true,
                  content: true,
                },
              },
            },
          },
        },
      })
      .catch((e) => {
        console.log(e);
      })
      .then((data) => {
        return data;
      });
    const getIsSubmitted = await prisma.answer
      .findFirst({
        where: {
          usersId: socket.data.userID,
          quizSessionId: getQuizSession?.id,
          questionId: getQuizSession?.Question?.id,
          QuizSession: {
            isActive: true,
          },
        },
      })
      .then((data) => {
        if (data != null) {
          return true;
        }
        return false;
      });
    socket.emit("QuizLoad", {
      has_submitted: getIsSubmitted,
      question: getQuizSession?.Question,
    });
  });

  socket.on("AdminQuizLoad", async (dataIO) => {
    const getAllUserInRoomAttendee = await prisma.room
      .findFirst({
        where: {
          room: dataIO.Roomname,
        },
        include: {
          attendees: true,
        },
      })
      .then((data) => {
        return data?.attendees.length || 0;
      });
    const getQuestionIDFromSession = await prisma.quizSession
      .findFirst({
        where: {
          roomName: dataIO.Roomname,
          isActive: true,
        },
      })
      .catch((e) => {
        console.log(e);
      })
      .then((data) => {
        console.log(data);
        return data;
      });
    const getAnswerCount = await prisma.answer
      .findMany({
        where: {
          questionId: getQuestionIDFromSession?.questionId || 0,
          quizSessionId: getQuestionIDFromSession?.id || 0,
        },
      })
      .catch((e) => {
        console.log(e);
      })
      .then((data) => {
        console.log(data);
        return data;
      });
    console.log(getAllUserInRoomAttendee);
    socket.emit("AdminQuizLoad", {
      LastQuestion:
        socket.data.QuestionIndex == socket.data.questionArr.length - 1,
      FirstQuestion: socket.data.QuestionIndex == 0,
    });
  });
  socket.on("AnswerSubmit", async (dataIO) => {
    const GetQuizID = await prisma.question
      .findUnique({
        where: {
          id: dataIO.QuestionID,
        },
        select: {
          quizId: true,
        },
      })
      .catch((e) => {
        console.log(e);
      })
      .then((data) => {
        return data?.quizId;
      })
      .finally(() => {
        prisma.$disconnect();
      });
    const choiceID: any = dataIO.choice;
    const QuestionID: any = dataIO.QuestionID;
    const userID: any = socket.data.userID;
    const getQuizSessionID: any = await prisma.quizSession
      .findFirst({
        where: {
          roomName: dataIO.Roomname,
          isActive: true,
        },
      })
      .catch((e) => {
        console.log(e);
      })
      .then((data) => {
        return data?.id;
      })
      .finally(() => {
        prisma.$disconnect();
      });
    const CreateAnswer: any = await prisma.answer
      .create({
        data: {
          choiceId: choiceID,
          questionId: QuestionID,
          quizId: GetQuizID,
          usersId: userID,
          quizSessionId: getQuizSessionID,
        },
      })
      .catch((e) => {
        console.log(e);
      })
      .then(() => {
        socket.emit("AnswerSubmited", { has_Submitted: true });
      });
    socket.emit("refresh");
    socket.to(dataIO.Roomname).emit("refresh");
  });
  socket.on("Done", async (dataIO) => {
    const getSessionID = await prisma.quizSession
      .findFirst({
        where: {
          roomName: dataIO.Roomname,
          isActive: true,
        },
        select: {
          id: true,
        },
      })
      .then((data) => {
        console.log(data);
        return data;
      })
      .catch((e) => {
        console.log(e);
      })
      .finally(() => {
        prisma.$disconnect();
      });
    const sessionIsDone = await prisma.quizSession.updateMany({
      where: {
        roomName: dataIO.Roomname,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
    console.log(sessionIsDone);
    socket.emit("redirectToDone", {
      PageName: "leaderboard",
      session: getSessionID,
    });
    socket
      .to(dataIO.Roomname)
      .emit("redirectToDone", { PageName: "feedback", session: getSessionID });
  });
};
