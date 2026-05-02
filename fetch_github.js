async function main() {
    const res = await fetch('https://1welcorn.github.io/Wordfall/');
    const data = await res.text();
    console.log(data);
}
main();
