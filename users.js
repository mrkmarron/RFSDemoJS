const path = require("path");
const fs = require("fs");

let _users;
let _userMap;
const _rootDir = path.join(__dirname, "testdata");

function getUsers() {
    if (!_users) {
        loadUsers();
    }
    return _users;
}

function loadUsers() {
    const data = fs.readFileSync(path.join(_rootDir, "userConfig.json"));
    _users = JSON.parse(data);
    _userMap = _users.reduce((acc, user) => {
        acc[user.userName] = user;
        return acc;
    }, {});
}

function getUser(userName) {
    if (!_userMap) {
        loadUsers();
    }
    return _userMap[userName];
}

module.exports.getUsers = getUsers;
module.exports.getUser = getUser;
