const promise = new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve(console.log("Promise completed success!"));
        // reject("Promise failed with error!");
    }, 2000);
});

promise
    .then(() => {
        console.log("Promise RESOLVED!");
    })
    .catch(() => {
        console.log("Promise FAILED!");
    });
