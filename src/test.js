function concatMaxValue(input) {
    return input.sort((a, b) => {

        let FirstDigitA =  +a.toString()[0]
        let FirstDigitB =  +b.toString()[0]

        if(FirstDigitA === FirstDigitB){
            let rank = Math.max(a,b).toString().length - 1
            let transfromMinValue = Math.min(a,b) * 10 ** rank + Math.min(a,b)
            return Math.max(a,b) - transfromMinValue
        }

        return  FirstDigitB - FirstDigitA
    }).join('')
}

let input = [78, 2, 1, 6]
console.log(concatMaxValue(input));