
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static("."));

mongoose.connect(process.env.MONGO_URI, { dbName: "test" })
    .then(() => {
        console.log("MongoDB connected successfully");
        console.log("Database:", mongoose.connection.name);
    })
    .catch(error => console.log("MongoDB error:", error.message));

// Student schema
const studentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 10, max: 99 },
    courseID: { type: String, required: true },
    cgpa: { type: Number, required: true, min: 0, max: 10 },
    marks: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        validate: {
            validator: Number.isInteger,
            message: "Marks must be a whole number from 0 to 100"
        }
    }
}, { versionKey: false });

const Student = mongoose.model("Student", studentSchema, "students");

// Course schema
const courseSchema = new mongoose.Schema({
    courseID: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: /^[A-Za-z0-9]{1,6}$/
    },
    courseName: {
        type: String,
        required: true,
        trim: true,
        match: /^[A-Za-z]+(?: [A-Za-z]+)*$/
    },
    credits: {
        type: Number,
        required: true,
        min: 1,
        max: 9,
        validate: {
            validator: Number.isInteger,
            message: "Credits must be a whole number from 1 to 9"
        }
    }
}, { versionKey: false });

const Course = mongoose.model("Course", courseSchema, "courses");

// GET students
app.get("/api/students", async (req, res) => {
    try {
        res.json(await Student.find().lean());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD student
app.post("/api/students", async (req, res) => {
    try {
        const { name, age, courseID, cgpa, marks } = req.body;

        // Validate the foreign key
        const course = await Course.findOne({ courseID });

        if (!course) {
            return res.status(400).json({
                error: "Please select a valid course"
            });
        }

        const student = await Student.create({
            name,
            age,
            courseID: course.courseID,
            cgpa,
            marks
        });

        res.json({
            message: "Student added successfully",
            student
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE student
app.delete("/api/students/:id", async (req, res) => {
    try {
        const student = await Student.findByIdAndDelete(req.params.id);

        if (!student) {
            return res.status(404).json({
                error: "Student not found"
            });
        }

        res.json({ message: "Student deleted successfully" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET courses
app.get("/api/courses", async (req, res) => {
    try {
        res.json(await Course.find().lean());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD course
app.post("/api/courses", async (req, res) => {
    try {
        const course = await Course.create({
            courseID: req.body.courseID,
            courseName: req.body.courseName,
            credits: req.body.credits
        });

        res.json({
            message: "Course added successfully",
            course
        });
    } catch (error) {
        res.status(400).json({
            error: error.code === 11000
                ? "Course ID already exists"
                : error.message
        });
    }
});

// DELETE course
app.delete("/api/courses/:id", async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({
                error: "Course not found"
            });
        }

        // Do not delete a course currently selected by students
        const studentsUsingCourse = await Student.countDocuments({
            courseID: course.courseID
        });

        if (studentsUsingCourse > 0) {
            return res.status(400).json({
                error: "This course is selected by students. Reassign those students before deleting it."
            });
        }

        await Course.findByIdAndDelete(req.params.id);

        res.json({ message: "Course deleted successfully" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// SEVEN JOIN OPERATIONS
app.get("/api/joins", async (req, res) => {
    try {
        const students = Student.collection.name;
        const courses = Course.collection.name;
        const joins = {};

        // 1. INNER JOIN
        joins.inner = await Student.aggregate([
            {
                $lookup: {
                    from: courses,
                    localField: "courseID",
                    foreignField: "courseID",
                    as: "c"
                }
            },
            { $unwind: "$c" },
            {
                $project: {
                    _id: 0,
                    studentID: "$_id",
                    name: 1,
                    cgpa: 1,
                    marks: 1,
                    courseID: "$c.courseID",
                    courseName: "$c.courseName",
                    credits: "$c.credits"
                }
            }
        ]);

        // 2. LEFT OUTER JOIN
        joins.left = await Student.aggregate([
            {
                $lookup: {
                    from: courses,
                    localField: "courseID",
                    foreignField: "courseID",
                    as: "c"
                }
            },
            {
                $unwind: {
                    path: "$c",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 0,
                    studentID: "$_id",
                    name: 1,
                    cgpa: 1,
                    marks: 1,
                    courseID: "$courseID",
                    courseName: "$c.courseName",
                    credits: "$c.credits"
                }
            }
        ]);

        // 3. RIGHT OUTER JOIN
        joins.right = await Course.aggregate([
            {
                $lookup: {
                    from: students,
                    localField: "courseID",
                    foreignField: "courseID",
                    as: "s"
                }
            },
            {
                $unwind: {
                    path: "$s",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 0,
                    courseID: 1,
                    courseName: 1,
                    credits: 1,
                    studentID: "$s._id",
                    studentName: "$s.name",
                    cgpa: "$s.cgpa",
                    marks: "$s.marks"
                }
            }
        ]);

        // 4. FULL OUTER JOIN
        joins.full = await Student.aggregate([
            {
                $lookup: {
                    from: courses,
                    localField: "courseID",
                    foreignField: "courseID",
                    as: "c"
                }
            },
            {
                $unwind: {
                    path: "$c",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 0,
                    studentID: "$_id",
                    name: 1,
                    cgpa: 1,
                    marks: 1,
                    courseID: "$courseID",
                    courseName: "$c.courseName",
                    credits: "$c.credits"
                }
            },
            {
                $unionWith: {
                    coll: courses,
                    pipeline: [
                        {
                            $lookup: {
                                from: students,
                                localField: "courseID",
                                foreignField: "courseID",
                                as: "s"
                            }
                        },
                        { $match: { s: { $eq: [] } } },
                        {
                            $project: {
                                _id: 0,
                                studentID: { $literal: null },
                                name: { $literal: null },
                                cgpa: { $literal: null },
                                marks: { $literal: null },
                                courseID: 1,
                                courseName: 1,
                                credits: 1
                            }
                        }
                    ]
                }
            }
        ]);

        // 5. CROSS JOIN
        joins.cross = await Student.aggregate([
            {
                $lookup: {
                    from: courses,
                    pipeline: [],
                    as: "c"
                }
            },
            { $unwind: "$c" },
            {
                $project: {
                    _id: 0,
                    studentID: "$_id",
                    name: 1,
                    courseID: "$c.courseID",
                    courseName: "$c.courseName"
                }
            }
        ]);

        // 6. SELF JOIN: students with higher CGPA
        joins.self = await Student.aggregate([
            {
                $lookup: {
                    from: students,
                    let: {
                        currentID: "$_id",
                        marks: "$cgpa"
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $ne: ["$_id", "$$currentID"] },
                                        { $gt: ["$cgpa", "$$marks"] }
                                    ]
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                name: 1,
                                cgpa: 1
                            }
                        }
                    ],
                    as: "higher"
                }
            },
            {
                $unwind: {
                    path: "$higher",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 0,
                    studentName: "$name",
                    cgpa: 1,
                    higherStudent: "$higher.name",
                    higherCGPA: "$higher.cgpa"
                }
            }
        ]);

        // 7. NATURAL JOIN equivalent using courseID
        joins.natural = await Student.aggregate([
            {
                $lookup: {
                    from: courses,
                    localField: "courseID",
                    foreignField: "courseID",
                    as: "c"
                }
            },
            { $unwind: "$c" },
            {
                $project: {
                    _id: 0,
                    studentID: "$_id",
                    name: 1,
                    courseID: "$courseID",
                    courseName: "$c.courseName",
                    credits: "$c.credits"
                }
            }
        ]);

        res.json(joins);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// AGGREGATION OPERATIONS
app.get("/api/aggregates", async (req, res) => {
    try {
        const stats = await Student.aggregate([
            {
                $group: {
                    _id: null,
                    maxCGPA: { $max: "$cgpa" },
                    minCGPA: { $min: "$cgpa" },
                    avgCGPA: { $avg: "$cgpa" },
                    totalMarks: { $sum: "$marks" }
                }
            }
        ]);

        const courseStats = await Course.aggregate([
            {
                $group: {
                    _id: null,
                    totalCredits: { $sum: "$credits" }
                }
            }
        ]);

        const count = await Student.aggregate([
            { $count: "totalStudents" }
        ]);

        res.json({
            maxCGPA: stats[0]?.maxCGPA ?? 0,
            minCGPA: stats[0]?.minCGPA ?? 0,
            avgCGPA: stats[0]?.avgCGPA ?? 0,
            totalMarks: stats[0]?.totalMarks ?? 0,
            totalCredits: courseStats[0]?.totalCredits ?? 0,
            totalStudents: count[0]?.totalStudents ?? 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

mongoose.connection.once("open", () => {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
});
