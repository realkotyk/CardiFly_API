// Synchronious code flow
// console.log("Start");
// fooSynch();
// console.log("End");

// function fooSynch() {
//     console.log("My function operation...");
// }

// Asynchronious code flow
console.log("Async Start");

foo();

function foo() {
    setTimeout(() => {
        console.log("My async function operation...");
    }, 2000);
}
console.log("Async End");
