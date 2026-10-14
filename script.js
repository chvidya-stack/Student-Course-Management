
async function request(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

function showTable(elementId, data, deleteType = null, hiddenColumns = []) {
    const container = document.getElementById(elementId);
    container.replaceChildren();

    if (!data || data.length === 0) {
        container.textContent = "No records found.";
        return;
    }

    const columns = [
        ...new Set(data.flatMap(row =>
            Object.keys(row).filter(key =>
                key !== "__v" && !hiddenColumns.includes(key)
            )
        ))
    ];

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const header = document.createElement("tr");

    columns.forEach(column => {
        const th = document.createElement("th");
        th.textContent = column;
        header.appendChild(th);
    });

    if (deleteType) {
        const th = document.createElement("th");
        th.textContent = "Action";
        header.appendChild(th);
    }

    thead.appendChild(header);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    data.forEach(row => {
        const tr = document.createElement("tr");

        columns.forEach(column => {
            const td = document.createElement("td");
            const value = row[column];

            td.textContent =
                value === null || value === undefined
                    ? ""
                    : typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value);

            tr.appendChild(td);
        });

        if (deleteType) {
            const td = document.createElement("td");
            const button = document.createElement("button");

            button.textContent = "Delete";
            button.className = "delete";
            button.onclick = () => deleteRecord(deleteType, row._id);

            td.appendChild(button);
            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

// Load courses and show the course table
async function loadCourses() {
    const courses = await request("/api/courses");

    const rows = courses.map(course => ({
        _id: course._id,
        courseID: course.courseID,
        courseName: course.courseName,
        credits: course.credits
    }));

    showTable("courses", rows, "courses", ["_id"]);

    const select = document.getElementById("studentCourse");
    const previousValue = select.value;

    select.replaceChildren();

    const first = document.createElement("option");
    first.value = "";
    first.textContent = "Select Course";
    select.appendChild(first);

    courses.forEach(course => {
        const option = document.createElement("option");
        option.value = course.courseID;
        option.textContent = `${course.courseID} - ${course.courseName}`;
        select.appendChild(option);
    });

    if (courses.some(course => course.courseID === previousValue)) {
        select.value = previousValue;
    }
}

// Load students and show their selected course
async function loadStudents() {
    const [students, courses] = await Promise.all([
        request("/api/students"),
        request("/api/courses")
    ]);

    const courseNames = new Map(
        courses.map(course => [course.courseID, course.courseName])
    );

    const rows = students.map(student => ({
        _id: student._id,
        studentID: student._id,
        name: student.name,
        age: student.age,
        selectedCourse: courseNames.get(student.courseID)
            || student.courseID
            || "Not selected",
        cgpa: student.cgpa,
        marks: student.marks
    }));

    showTable("students", rows, "students", ["_id"]);
}

// Load all seven joins
async function loadJoins() {
    const joins = await request("/api/joins");

    showTable("inner", joins.inner);
    showTable("left", joins.left);
    showTable("right", joins.right);
    showTable("full", joins.full);
    showTable("cross", joins.cross);
    showTable("self", joins.self);
    showTable("natural", joins.natural);
}

// Load aggregation results
async function loadAggregates() {
    const data = await request("/api/aggregates");

    const rows = Object.entries(data).map(([operator, result]) => ({
        operator,
        result
    }));

    showTable("aggregates", rows);
}

// Add student
document.getElementById("studentForm").addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        const message = document.getElementById("studentMessage");

        try {
            const data = await request("/api/students", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: document.getElementById("studentName").value.trim(),
                    age: Number(document.getElementById("studentAge").value),
                    courseID: document.getElementById("studentCourse").value,
                    cgpa: Number(document.getElementById("studentCGPA").value),
                    marks: Number(document.getElementById("studentMarks").value)
                })
            });

            message.textContent = data.message;
            event.target.reset();

            await refreshAll();
        } catch (error) {
            message.textContent = error.message;
        }
    }
);

// Add course
document.getElementById("courseForm").addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        const message = document.getElementById("courseMessage");

        try {
            const data = await request("/api/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    courseID: document.getElementById("courseID").value.trim(),
                    courseName: document.getElementById("courseName").value.trim(),
                    credits: Number(document.getElementById("courseCredits").value)
                })
            });

            message.textContent = data.message;
            event.target.reset();

            await refreshAll();
        } catch (error) {
            message.textContent = error.message;
        }
    }
);

// Delete student or course
async function deleteRecord(type, id) {
    if (!id || !confirm("Are you sure you want to delete this record?")) {
        return;
    }

    try {
        const data = await request(`/api/${type}/${id}`, {
            method: "DELETE"
        });

        alert(data.message);
        await refreshAll();
    } catch (error) {
        alert(error.message);
    }
}

// Refresh every table after a change
async function refreshAll() {
    await loadCourses();
    await loadStudents();
    await loadJoins();
    await loadAggregates();
}

refreshAll().catch(error => {
    document.body.insertAdjacentText(
        "beforeend",
        " Error loading data: " + error.message
    );
});
