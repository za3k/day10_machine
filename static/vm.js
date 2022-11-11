    const WORD_MAX = 364;
    const WORD_MIN = -364;
    const MEMORY_SIZE = WORD_MAX;
    function clamp(w1) {
        if (w1 < WORD_MIN) return WORD_MIN;
        else if (w1 > WORD_MAX) return WORD_MAX;
        else return w1;
    }
    const ops = {
        RIGHT(w1) {
            const r = w1%3;
            if (r == 2) return [-1];
            return [r];
        },
        RSHIFT(w1) { return Math.trunc(w1/3); },
        LSHIFT(w1) { return [clamp(w1*3)]; },
        CMP(w1, w2) {
            if (w1 < w2) return -1;
            else if (w1 == w2) return 0;
            else return 1;
        },
        ADD(w1, w2) {
            const s = w1+w2;
            if (s > WORD_MAX) return [1, clamp(s)];
            else if (s < WORD_MIN) return [-1, clamp(s)];
            else return [0, clamp(s)];
        },
        add(t1, t2) {
            const s = t1 + t2;
            if (s == -2) return [-1, 1];
            else if (s == -1) return [0, -1];
            else if (s == 0) return [0, 0];
            else if (s == 1) return [0, 1];
            else if (s == 2) return [1, -1];
        },
        MUL(w1, t2) { return [w1*t2]; },
        mul(t1, t2) { return [t1*t2]; },
        MOV(w1) { return w1; },
        mov(t1) { return t1; },
        store(t1, w2) { vm.memoryWrite(w2, t1); return []; },
        load(w1) { return [vm.memoryRead(w1)]; },
        jump(l1) { return [l1]; },
        jz(t1, l1) { if (t1==0) return ops.jump(l1); else return [vm.I]; },
        jp(t1, l1) { if (t1>0) return ops.jump(l1); else return [vm.I]; },
        jn(t1, l1) { if (t1<0) return ops.jump(l1); else return [vm.I]; },
        random() { return Math.floor(Math.random()*3)-1; },
        halt() { vm.stop(); return []; },
        flush() { vm.flush(); return []; },
        IN() { return vm.input(); },
        OUT(w1) { vm.output(w1); return []; }
    };
    const INSTRUCTIONS = {
        RIGHT: [ops.RIGHT, "W", "t"],
        RSHIFT: [ops.RSHIFT, "W", "W"],
        LSHIFT: [ops.LSHIFT, "W", "W"],
        CMP: [ops.CMP, "WW", "t"],
        ADD: [ops.ADD, "WW", "tW"],
        add: [ops.add, "tt", "tt"],
        MUL: [ops.MUL, "Wt", "W"],
        mul: [ops.mul, "tt", "t"],
        store: [ops.store, "tW", ""],
        MOV: [ops.MOV, "W", "W"],
        mov: [ops.mov, "t", "t"],
        load: [ops.load, "W", "t"],
        jump: [ops.jump, "L", "I"],
        jz: [ops.jz, "tL", "I"],
        je: [ops.jz, "tL", "I"],
        jg: [ops.jp, "tL", "I"],
        jp: [ops.jp, "tL", "I"],
        jn: [ops.jn, "tL", "I"],
        jl: [ops.jn, "tL", "I"],
        random: [ops.random, "", "t"],
        halt: [ops.halt, "", ""],
        flush: [ops.flush, "", ""],
        IN: [ops.IN, "", "Wt"],
        OUT: [ops.OUT, "W", ""],
    };
    function parseInput(expected, actual) {
        // Parse actual as an integer if possible
        const num = parseInt(actual);
        if (!isNaN(num)) actual = num;

        // Figure out what the RHS is
        let type = null;
        if ("ABC".includes(actual) && "W".includes(expected)) type = "R";
        else if ("def".includes(actual) && "Wt".includes(expected)) type = "R";
        else if ([-1, 0, 1].includes(actual) && "Wt".includes(expected)) type = "C";
        else if (typeof(actual) == "Number" && WORD_MIN <= actual && actual <= WORD_MAX && "W".includes(expected)) type = "C";
        else if (expected == "L") type = "L";

        if (!type) console.log("input", expected, actual, type);

        if (type != null) return {
            type: type,
            val: actual,
        }
    }
    function parseOutput(expected, actual) {
        // Figure out what the LHS is
        let type = null;
        if ("ABC".includes(actual) && "Wt".includes(expected)) type = "R";
        else if ("def".includes(actual) && "t".includes(expected)) type = "R";
        else if ("I".includes(actual) && "I".includes(expected)) type = "I";

        if (!type) console.log("output", expected, actual, type);
        if (type != null) return {
            type: type,
            val: actual,
        }
    }
    function parseProgram(text) {
        vm.html.error.text("");
        const lines = text.split(/\r|\n/);
        let instructions = [];
        let labels = {};
        let i = 0;
        for (let j=0; j<lines.length; j++) {
            let line = lines[j];
            // Remove any comment and strip whitespace
            line = line.split("#")[0].trim()
            if (line == "") continue; // Ignore blank lines and comments

            // Mark any label
            const labelMatch = line.match(/^([a-zA-Z]+) *: */);
            if (labelMatch) {
                labels[labelMatch[1]] = i;
                line = line.substr(labelMatch[0].length);
            }
            // Parse the rest
            let inputs = [];
            let outputs = [];
            let iname = null;
            let phase = 0;
            const parts = line.split(/\s/);
            error = (m) => {
                const message = `${m} | on line ${i}: ${lines[j]}`;
                vm.html.error.text(message);
                throw message;
            }
            parts.forEach(part => {
                if (part == "") return;
                else if (phase == 0 && part == "=") phase=1;
                else if (phase == 0) outputs.push(part);
                else if (part == "=") error("seconds equals");
                else if (phase == 1) { iname = part; phase = 2; }
                else if (phase == 2) inputs.push(part);
            });
            if (phase == 0) { // No left hand side
                iname = outputs[0]
                inputs = outputs.slice(1)
                outputs = []
            } else if (phase < 2) error("invalid line");

            if (!INSTRUCTIONS[iname]) error(`invalid opcode [${iname}]`);
            const [op, expectedIn, expectedOut] = INSTRUCTIONS[iname];

            if (expectedIn.length != inputs.length) error("too few/many inputs");
            let parsedInputs = [];
            for (let x=0; x<expectedIn.length; x++) {
                const p = parseInput(expectedIn[x], inputs[x]);
                if (!p) error("Invalid input register/constant");
                parsedInputs.push(p);
            }

            if (expectedOut.length != outputs.length) error("too few/many outputs");
            let parsedOutputs = [];
            for (let x=0; x<expectedOut.length; x++) {
                const p = parseOutput(expectedOut[x], outputs[x]);
                if (!p) error("Invalid output register");
                parsedOutputs.push(p);
            }

            instructions[i] = {
                inputs: parsedInputs,
                line: i,
                name: iname,
                outputs: parsedOutputs,
                op,
                original: lines[j],
            };
            i++;
        }

        return {
            instructions,
            labels,
            text,
            lines,
        };
    }
    
    const REGISTERS = ["A", "B", "C", "d", "e", "f", "I"];
    const vm = {
        attach(html) {
            this.html = html;
            this.clear();
            ["step", "run", "stop", "pause"].forEach(x => {
                this.html[x].on("click", this[x].bind(this));
            });
            for (let i=WORD_MIN; i<=WORD_MAX; i++) this._memoryHtml(i).data("address", i);
            this.html.memory.find("td").on("click", (event) => {
                const address = $(event.target).data("address");
                this.memoryWrite(address, 0);
            })
            this.tick();
            this.setState("Reset");
        },
        clear() {
            this.visual = false;
            this.m = [];
            this.running = false;
            for (let i=WORD_MIN; i<=WORD_MAX; i++) this.memoryWrite(i, 0);
            REGISTERS.forEach((R)=>{
                this._writeOperand({type: "R", val: R}, 0, true)
            });
            this.output = "";
            this.html.output.text();
            this.running = false;
            this.started = false;
            this.halted = false;
            this.visual = true;
        },
        doInput() { // ascii, eof
            const chr = this.input.charCodeAt[0];
            this.input = this.input.substring(1);
            return [chr, this.input.length == 0];
        },
        doOutput(chr) {
            this.output += String.fromCharCode(chr);
        },
        doStep() {
            if (this.halted) return;

            this._clearHighlights();
            // Read instruction
            const instruction = this.instructions[this.I];
            //console.log(this.I,instruction);
            // Advance instruction pointer
            this.I = (this.I + 1) % MEMORY_SIZE;
            // Update instruction display if requested
            if (this.visual) {
                this.html.instruction.text(instruction.name);
                this.html.I.text(this.I-1);
            }
            // Read operands
            let inputs = [];
            for (let i=0; i<instruction.inputs.length; i++) inputs[i] = this._readOperand(instruction.inputs[i]);
            // Compute answer
            const result = instruction.op.apply(null, inputs);
            // Write operands
            for (let i=0; i<result.length; i++) this._writeOperand(instruction.outputs[i], result[i]);
            //console.log({ A: this.A, B: this.B, C: this.C, d: this.d, e: this.e, f: this.f, I: this.I, m: this.m, });
        },
        flush() {
            // No-op until we implement fast mode.
            // Write all of memory
            // Write all registers
            // Write current instruction and IP
        },
        loadProgram() {
            this.program = this.html.program.text();
            this.html.program.attr("disabled", "true");
            this.input = this.html.input.text();
            const r = parseProgram(this.program);
            console.log(r)
            this.instructions = r.instructions;
            this.labels = r.labels;
        },
        _memoryHtml(address) {
            return $(this.html.memory.find("td.trit")[address-WORD_MIN]); // jquery array is 0-based, but memory is -364 based
        },
        memoryRead(address) {
            const cell = this._memoryHtml(address);
            if (this.visual) cell.toggleClass("highlight-input", true);
            return this.m[address];
        },
        memoryWrite(address, val) {
            const cell = this._memoryHtml(address);
            this.m[address] = val;
            this._setTrit(cell, val);
            if (this.visual) cell.toggleClass("highlight-output", true);
        },
        pause() {
            this.running = false;
            this.setState("Paused");
            this.flush();
        },
        run() {
            if (this.running) return;
            if (this.halted) this.clear();
            if (!this.started) this.start();
            this.visual = false;
            this.running = true;
            this.setState("Running");
        },
        setState(text) {
            this.html.status.text(text);
        },
        start() {
            this.clear();
            this.loadProgram();
            this.started = true;
        },
        step() {
            if (!this.started) this.start();
            this.visual = true;
            this.running = false;
            this.doStep(true);
            this.setState("Paused");
        },
        stop() {
            console.log("Stopping");
            this.running = false;
            this.halted = true;
            this.flush();
            this.html.program.attr("disabled", "false");
            this.setState("Stopped");
            this.visual = true;
        },
        tick() {
            setTimeout(() => {
                if (this.running) this.doStep(false);
                this.tick();
            }, 50);
        },
        _clearHighlights() {
            REGISTERS.forEach((R)=>{
                this.html[R].toggleClass("highlight-output",false);
                this.html[R].toggleClass("highlight-input",false);
            })
            this.html.memory.find(".highlight-input").toggleClass("highlight-input", false);
            this.html.memory.find(".highlight-output").toggleClass("highlight-output", false);
        },
        _writeOperand(loc, val) {
            if (loc.type == "R" || loc.type == "I") { // Register
                this[loc.val] = val;
                const register = this.html[loc.val].find(".register");
                if ("def".includes(loc.val)) this._setTrit(register, val);
                else register.text(val);
                if (this.visual) this.html[loc.val].toggleClass("highlight-output",true);
            }
        },
        _setTrit(element, val) {
            element.toggleClass("zero", val==0);
            element.toggleClass("positive", val>0);
            element.toggleClass("negative", val<0);
        },
        _readOperand(loc) {
            if (loc.type == "R") { // Register
                if (this.visual) this.html[loc.val].toggleClass("highlight-input",true);
                return this[loc.val];
            } else if (loc.type == "C") { // Constant
                return loc.val;
            } else if (loc.type == "L") { // Constant (Label)
                return this.labels[loc.val];
            }
        },
    }

$(document).ready(() => {
    vm.attach({
        memory: $("#memory"),
        A: $(".A"),
        B: $(".B"),
        C: $(".C"),
        d: $(".d"),
        e: $(".e"),
        f: $(".f"),
        I: $(".I"),
        instruction: $(".instruction"),
        program: $(".program"),
        input: $(".input"),
        output: $(".output"),
        step: $(".step"),
        run: $(".run"),
        stop: $(".stop"),
        pause: $(".pause"),
        error: $(".error"),
        status: $(".status"),
    });
});
