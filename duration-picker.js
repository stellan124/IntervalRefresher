const time_units = [
    ["Days", 86400],
    ["Hours", 3600],
    ["Minutes", 60],
    ["Seconds", 1]
];

let filterDigits = (e) => {
    // Used to disable e and - input for input elements
    return !(e.keyCode === 69 || e.keyCode === 189 || e.keyCode === 190);
};

const DurationPicker = class {
    target;
    inputs = [];
    input_width = "50px";

    constructor(target, input_width = "50px") {
        this.target = target;
        this.input_width = input_width;
        for (let i = 0; i < time_units.length; i++) {
            this.addInputCell(time_units[i][0], time_units[i][1]);
        }
        this.balanceVals();
        this.target["reset"] = () => {
            this.reset();
        };
        this.target["balanceVals"] = () => {
            this.balanceVals();
        }
    }

    addInputCell(label_text, magnitude) {
        let container = document.createElement("div");
        let input = document.createElement("input");
        input["data-magnitude"] = magnitude;
        console.log(input["data-magnitude"]);
        input.type = "number";
        input.style.width = this.input_width;
        input.onkeydown = filterDigits;
        let label = document.createElement("p");
        label.innerHTML = label_text;

        input.min = "0";
        input.value = "0";

        input.addEventListener("blur", () => {
            this.balanceVals();
        });

        this.inputs.push(input);
        this.target.appendChild(container);

        container.appendChild(input);
        container.appendChild(label);
    }

    reset() {
        this.inputs.forEach((element) => {
            element.value = "0";
        });
        this.balanceVals();
    }

    balanceVals() {
        console.log(this.inputs);
        let total = 0;
        this.inputs.forEach((element) => {
            console.log(element["data-magnitude"]);
            total += parseInt(element.value) * element["data-magnitude"];
        });
        this.target.value = String(total);
        this.inputs.forEach((element) => {
            let magnitude = element["data-magnitude"];
            let val = total - (total % magnitude);
            let multiples = val / magnitude;
            total = total - val;
            element.value = String(multiples);
        });
    }
};

document.addEventListener("DOMContentLoaded",  () => {
    let duration_picker_elements = document.getElementsByClassName("duration-picker");
    console.log(duration_picker_elements);
    for (let i = 0; i < duration_picker_elements.length; i++) {
        new DurationPicker(duration_picker_elements[i]);
    }
});