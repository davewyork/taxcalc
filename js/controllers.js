/*1st stab at teligibleting instructions to code*/
/*
 Term Translation
 -----------------
 X = HIPAmtPaid
 Y = HIPDeduction
 Z = PTCredit
 AGI
 A = SLCSP
 B = FPL
 P = AFMult

 Instructions Translation
 -------------------------
 1) Set HIPDeduction = HIPAmtPaid, Calc AGI

 2) Calc PASubsidy1
 2a) (AGI * FPL) * 100 = % of FPL, >132, <400
 2b) Use AFTable to get AFMultiplier
 2c) (AFMult * AGI) = Annual Contribution Limit
 SLCSP - (AFMult * AGI) = PASubsidy_1, if(PASubsidy1 < HIPAmtPaid) Continue
 elseif(PASubsidy_1 >= HIPAmtPaid) HIPAmtPaid = PASubsidy_1

 3) Iterate until |PASubsidy_2 - PASubsidy_1| < 1 and |(HIPDeduction_n + 1 - HIPDeduction_n)|
 3a) Let HIPAmtPaid - PASubsidy_1 = 1/2
 3b) Delta? - 1/2 = AGI_2                                  |(PASubsidy_n + 1 - PASubsidy_n)| < 1
 3c) (AGI_2 / FPL) x 100 => Lode up AFMult_2 < 1
 3d) SLCSP - (AFMult * AGI_2) = PASubsidy_2
 */

///////////////////Test cases///////////////////////
//HIPDeduction = 14000, //heath insurance premium deduction
//AGI = 68425, //adjusted gross income
///////////////////End Test cases///////////////////////


//Controllers.js contains all of the core logic for the SE-HIP-calc app
function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

var ICApp = angular.module('ICApp', ['ngSanitize']);
ICApp.controller('ICController', function($scope){
    $scope.MAGIncome = '';          //modified adjusted gross income
    $scope.HIPremium = '';          //heath insurance premium
    $scope.SLCSP = '';               //second lowest cost health plan
    $scope.outputStream = '';
    $scope.states = ["no", "alaska", "hawaii"];
    $scope.selectedState = $scope.states[0];
    $scope.familySize = '';
    $scope.done = "";

    $scope.FAGIncome = 0;          //final adjusted gross income
    $scope.FTSubsidy = 0;          //final tax subsidy
    $scope.FHIPDeduction = 0;      //final health insurance premium deduction

    /************
     * Contains the main calculation logic
     **************/
    $scope.submit = function($sanitize){

        //initial variables, user inputs, fixed numbers
        var HIPAmtPaid = 0,
            HIPDeduction = $scope.HIPremium,//3332, //heath insurance premium deduction
            AGI = $scope.MAGIncome,//27212, //adjusted gross income
            FPL = 0,
            output = "",
            iterationCount = 0,
            PTCredit = 0, //Premium Tax Credit
            AFMult = 0; //Applicable figure multiplier (uses lookup table)

        //iterative calculation variables
        var curAGI,
            prevAGI,
            curHIPDeduction,
            prevHIPDeduction,
            curPTCredit,
            prevPTCredit;

        $scope.done = ""; //clear the formatting for the output boxes
        $scope.outputStream = output = "<ul>";

        //Initial calculations
        HIPAmtPaid = HIPDeduction;
        output += "<li>Initial Health Insurance Premium Amount Paid: " + HIPAmtPaid + "</li>";

        AFMult = $scope.getAFMult(AGI);
        if(AFMult === false){return false;}
        output += "<li>Initial Applicable Figure Multiplier lookup: " + AFMult + "</li>";

        PTCredit = $scope.calcTaxCredit(AFMult, AGI);
        output += "<li>Annual Maximum Premium Assistance : " + PTCredit + "</li>";

        FPL = $scope.getFPL();
        output += "<li>Federal Poverty Level for Family of " + $scope.familySize +  " : " + FPL + "</li>";

        //iteration current variable initialization
        curPTCredit = PTCredit;
        curHIPDeduction = HIPDeduction;
        curAGI = AGI;

        do{
            iterationCount++;
            output += "<li><ul>Iteration : " + iterationCount + "";

            //store previous values
            prevPTCredit = curPTCredit;
            prevAGI = curAGI;
            prevHIPDeduction = curHIPDeduction;

            //calculate current values
            curHIPDeduction = Math.round(HIPAmtPaid - prevPTCredit);
            output += "<li>Health Insurance Premium Deduction : " + curHIPDeduction + "</li>";

            curAGI = Math.round((prevHIPDeduction + prevAGI) - curHIPDeduction);
            output += "<li>Adjusted Gross Income : " + curAGI + "</li>";

            AFMult = $scope.getAFMult(curAGI);
            output += "<li>Applicable Figure Multiplier : " + AFMult + "</li>";

            curPTCredit = $scope.calcTaxCredit(AFMult, curAGI);
            output += "<li>Premium Tax Credit : " + curPTCredit + "</li></ul></li>";

        }while(
        ((Math.abs(curPTCredit - prevPTCredit) > 1) ||
        (Math.abs(curHIPDeduction + 1 - prevHIPDeduction) > 1)) &&
        (iterationCount < 20)
            );

        output += "<li class='text-center'>Complete</li>";
        output += "</ul>";
        $scope.outputStream = output;
        $scope.done = "callout";
        $scope.FAGIncome = curAGI;
        $scope.FHIPDeduction = curHIPDeduction;
        $scope.FTSubsidy = curPTCredit;
    }


    $scope.calcTaxCredit = function(AFMult, AGI){
        var SLCSP = $scope.SLCSP, //second lowest cost silver plan
        //Form 1095a line 33 column B
        //var SLCSP = 14000, //IRS example
            ACAmt = Math.round(AFMult * AGI);

        return Math.round(SLCSP - ACAmt);
    }

    $scope.getFPL = function(){
        var state = $scope.selectedState,
            familySize = $scope.familySize,
            extraFamily = 0,
            FPL = 0;

        if(familySize > 8){
            extraFamily = familySize - 8;
            familySize = 8;
        }
        familySize -= 1; //arrays are 0 indexed

        if(state === 'no'){
            FPL = $scope.FPLTable[familySize];
            FPL += (extraFamily * $scope.FPLExtra);
        }
        else if(state === 'alaska'){
            FPL = $scope.FPLTableAK[familySize];
            FPL += (extraFamily * $scope.FPLExtraAK);
        }
        else if(state === 'hawaii'){
            FPL = $scope.FPLTableHI[familySize];
            FPL += (extraFamily * $scope.FPLExtraHI);
        }
        else{
            return false;
        }
        return FPL;
    }

    //2013 Federal Poverty Level tables from http://aspe.hhs.gov/poverty/13poverty.cfm
    //2013 Data used because of how it relates to obamacare
    //Alaska and Hawaii use their own specific tables
    $scope.FPLTable = [
        11490,
        15510,
        19530,
        23550,
        27570,
        31590,
        35610,
        39630
    ];
    $scope.FPLExtra = 4020;

    /*Hawaii*/
    $scope.FPLTableHI = [
        13230,
        17850,
        22470,
        27090,
        31710,
        36330,
        40950,
        45570
    ];
    $scope.FPLExtraHI = 4620;

    /*Alaska*/
    $scope.FPLTableAK = [
        14350,
        19380,
        24410,
        29440,
        34470,
        39500,
        44530,
        49560
    ];
    $scope.FPLExtraAK = 5030;

    $scope.errorMessage = function(message, cssClass){
        $scope.FAGIncome = '-';          //final adjusted gross income
        $scope.FTSubsidy = '-';          //final tax subsidy
        $scope.FHIPDeduction = '-';      //final health insurance premium deduction
        $scope.done = cssClass;
        $scope.outputStream = message;
    }

    //Accesses the applicable figure
    //FPL = Federal Poverty Level
    //FPL = 23550; //IRS test example
    $scope.getAFMult = function(AGI){
        var FPL = $scope.getFPL(),
            perFPL = ((AGI / FPL) * 100);

        //check for error messages, then round if needed
        if(perFPL > 400){
            $scope.errorMessage(
                "<p>In order to qualify for the Premium Tax Credit, your household income must be no more than 400% of the Federal Poverty level, for your family size.</p>" +
                "<p>You are not eligible for the Premium Tax Credit.</p>",
                "errorCallout");
            return false;
        }
        else if(perFPL < 100){
            $scope.errorMessage(
                "<p>You may be qualified for the Premium Tax Credit. However, your situation is out of the scope of this tool.</p>" +
                "<p>Please consult the IRS instructions for form 8962 or contact a tax professional.</p>",
                "outOfScopeCallout");
            return false;
        }
        else if(perFPL > 399){
            perFPL = 399;
        }
        else{
            perFPL = Math.round(perFPL);
        }

        //lookup
        if(perFPL > 299){
            return 0.095;
        }
        else if(perFPL < 133){
            return 0.02;
        }
        else{
            return $scope.AFTable[perFPL - 132];
        }
    }

    $scope.AFTable = [ //Applicable figure
        0.02,
        0.03,
        0.0306,
        0.0312,
        0.0318,
        0.0324,
        0.0329,
        0.0335,
        0.0341,
        0.0347,
        0.0353,
        0.0359,
        0.0365,
        0.0371,
        0.0376,
        0.0382,
        0.0388,
        0.0394,
        0.04,
        0.0405,
        0.0409,
        0.0414,
        0.0418,
        0.0423,
        0.0428,
        0.0432,
        0.0437,
        0.0441,
        0.0446,
        0.0451,
        0.0455,
        0.046,
        0.0464,
        0.0469,
        0.0474,
        0.0478,
        0.0483,
        0.0487,
        0.0492,
        0.0497,
        0.0501,
        0.0506,
        0.051,
        0.0515,
        0.052,
        0.0524,
        0.0529,
        0.0533,
        0.0538,
        0.0543,
        0.0547,
        0.0552,
        0.0556,
        0.0561,
        0.0566,
        0.057,
        0.0575,
        0.0579,
        0.0584,
        0.0589,
        0.0593,
        0.0598,
        0.0602,
        0.0607,
        0.0612,
        0.0616,
        0.0621,
        0.0625,
        0.063,
        0.0634,
        0.0637,
        0.0641,
        0.0644,
        0.0648,
        0.0651,
        0.0655,
        0.0658,
        0.0662,
        0.0665,
        0.0669,
        0.0672,
        0.0676,
        0.0679,
        0.0683,
        0.0686,
        0.069,
        0.0693,
        0.0697,
        0.07,
        0.0704,
        0.0707,
        0.0711,
        0.0714,
        0.0718,
        0.0721,
        0.0725,
        0.0728,
        0.0732,
        0.0735,
        0.0739,
        0.0742,
        0.0746,
        0.0749,
        0.0753,
        0.0756,
        0.076,
        0.0763,
        0.0767,
        0.077,
        0.0774,
        0.0777,
        0.0781,
        0.0784,
        0.0788,
        0.0791,
        0.0795,
        0.0798,
        0.0802,
        0.0805,
        0.0808,
        0.0811,
        0.0814,
        0.0817,
        0.082,
        0.0822,
        0.0825,
        0.0828,
        0.0831,
        0.0834,
        0.0837,
        0.084,
        0.0843,
        0.0846,
        0.0849,
        0.0851,
        0.0854,
        0.0857,
        0.086,
        0.0863,
        0.0866,
        0.0869,
        0.0872,
        0.0875,
        0.0878,
        0.088,
        0.0883,
        0.0886,
        0.0889,
        0.0892,
        0.0895,
        0.0898,
        0.0901,
        0.0904,
        0.0907,
        0.0909,
        0.0912,
        0.0915,
        0.0918,
        0.0921,
        0.0924,
        0.0927,
        0.093,
        0.0933,
        0.0936,
        0.0938,
        0.0941,
        0.0944,
        0.0947,
        0.095
    ]
})
$(document).ready(function(){
    $('#introModal').foundation('reveal', 'open');
});

