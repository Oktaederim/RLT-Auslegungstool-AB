document.addEventListener('DOMContentLoaded', () => {

    // DOM Elements
    const inputs = {
        roomArea: document.getElementById('roomArea'),
        roomHeight: document.getElementById('roomHeight'),
        heatingLoad: document.getElementById('heatingLoad'),
        coolingLoad: document.getElementById('coolingLoad'),
        roomTemp: document.getElementById('roomTemp'),
        volumeFlowSlider: document.getElementById('volumeFlowSlider'),
        volumeFlowMin: document.getElementById('volumeFlowMin'),
        volumeFlowMax: document.getElementById('volumeFlowMax')
    };

    const outputs = {
        recommendedVolumeFlow: document.getElementById('recommendedVolumeFlow'),
        volumeFlowValue: document.getElementById('volumeFlowValue'),
        supplyTempHeating: document.getElementById('supplyTempHeating'),
        supplyTempCooling: document.getElementById('supplyTempCooling'),
        heatingHint: document.getElementById('heatingHint'),
        coolingHint: document.getElementById('coolingHint'),
        flowRateInfo: document.getElementById('flowRateInfo')
    };

    const airProperties = {
        cp: 0.34 // Vereinfachter Faktor [Wh/(m³*K)]
    };

    let state = {
        totalHeatingLoadWatts: 0,
        totalCoolingLoadWatts: 0,
        isInitialCalculation: true
    };

    function calculate() {
        // --- 1. Get and validate inputs ---
        const roomArea = parseFloat(inputs.roomArea.value) || 0;
        const roomHeight = parseFloat(inputs.roomHeight.value) || 0;
        const heatingLoadKW = parseFloat(inputs.heatingLoad.value) || 0;
        const coolingLoadKW = parseFloat(inputs.coolingLoad.value) || 0;
        
        state.totalHeatingLoadWatts = heatingLoadKW * 1000;
        state.totalCoolingLoadWatts = coolingLoadKW * 1000;
        
        if (roomArea > 0 && roomHeight > 0) {
            updateSliderRangeAndValue(roomArea, roomHeight);
        }

        updateVolumeFlowDisplay();
        calculateAndDisplayTemps();
        state.isInitialCalculation = false;
    }

    function updateSliderRangeAndValue(roomArea, roomHeight) {
        const roomVolume = roomArea * roomHeight;
        const hygienicFlow = roomVolume * 2; // Hygienic flow at 2x air change rate
        outputs.recommendedVolumeFlow.textContent = `${hygienicFlow.toFixed(0)} m³/h`;

        // Estimate a flow needed to handle the max load with a reasonable deltaT of 8K
        const maxLoad = Math.max(state.totalHeatingLoadWatts, state.totalCoolingLoadWatts, 1); // Avoid division by zero
        const loadBasedFlow = maxLoad / (airProperties.cp * 8);

        // Determine sensible min and max for the slider range
        const calculatedMin = Math.floor(Math.min(hygienicFlow, loadBasedFlow) / 2 / 10) * 10;
        const calculatedMax = Math.ceil(Math.max(hygienicFlow, loadBasedFlow, roomVolume * 8) * 1.5 / 10) * 10; // Ensure 8x ACH is possible
        
        // On initial calculation, set the new min/max values
        if (state.isInitialCalculation) {
            inputs.volumeFlowMin.value = Math.max(0, calculatedMin);
            inputs.volumeFlowMax.value = Math.max(100, calculatedMax);
            
            // Set slider to a sensible start value (hygienic flow or load-based)
            const initialSliderValue = Math.max(hygienicFlow, loadBasedFlow > 50 ? loadBasedFlow : hygienicFlow);
            inputs.volumeFlowSlider.value = initialSliderValue;
        }

        // Always update the slider's attributes from the input fields
        const min = parseFloat(inputs.volumeFlowMin.value) || 0;
        const max = parseFloat(inputs.volumeFlowMax.value) || 100;
        inputs.volumeFlowSlider.min = min;
        inputs.volumeFlowSlider.max = max;

        // Ensure current slider value is within the new range
        if (parseFloat(inputs.volumeFlowSlider.value) < min) {
            inputs.volumeFlowSlider.value = min;
        }
        if (parseFloat(inputs.volumeFlowSlider.value) > max) {
            inputs.volumeFlowSlider.value = max;
        }
    }

    function updateVolumeFlowDisplay() {
        const volumeFlow = parseFloat(inputs.volumeFlowSlider.value);
        outputs.volumeFlowValue.textContent = volumeFlow.toFixed(0);

        const roomArea = parseFloat(inputs.roomArea.value) || 0;
        const roomHeight = parseFloat(inputs.roomHeight.value) || 0;
        const roomVolume = roomArea * roomHeight;

        if (roomVolume > 0) {
            const airChangeRate = volumeFlow / roomVolume;
            outputs.flowRateInfo.textContent = `Das entspricht einer Luftwechselrate von ${airChangeRate.toFixed(1)} 1/h.`;
            outputs.flowRateInfo.className = 'info-box visible';
        } else {
            outputs.flowRateInfo.className = 'info-box';
        }
    }
    
    function calculateAndDisplayTemps() {
        const volumeFlow = parseFloat(inputs.volumeFlowSlider.value);
        const roomTemp = parseFloat(inputs.roomTemp.value) || 21;

        clearHints();

        if (volumeFlow === 0) {
            outputs.supplyTempHeating.textContent = '-- °C';
            outputs.supplyTempCooling.textContent = '-- °C';
            return;
        }

        // --- HEATING ---
        if (state.totalHeatingLoadWatts > 0) {
            const deltaT_heating = state.totalHeatingLoadWatts / (volumeFlow * airProperties.cp);
            const tempHeating = roomTemp + deltaT_heating;
            outputs.supplyTempHeating.textContent = `${tempHeating.toFixed(1)} °C`;
            if (deltaT_heating > 20) showHint(outputs.heatingHint, 'KRITISCH: Sehr hohe Übertemperatur. Gefahr von starker Luftschichtung.', 'critical');
            else if (deltaT_heating > 15) showHint(outputs.heatingHint, 'HINWEIS: Hohe Übertemperatur. Komfort kann beeinträchtigt sein.', 'warning');
        } else {
            outputs.supplyTempHeating.textContent = '-- °C';
        }

        // --- COOLING ---
        if (state.totalCoolingLoadWatts > 0) {
            const deltaT_cooling = state.totalCoolingLoadWatts / (volumeFlow * airProperties.cp);
            const tempCooling = roomTemp - deltaT_cooling;
            outputs.supplyTempCooling.textContent = `${tempCooling.toFixed(1)} °C`;
            if (deltaT_cooling > 10) showHint(outputs.coolingHint, 'KRITISCH: Sehr hohe Spreizung. Hohe Zugluftgefahr.', 'critical');
            else if (deltaT_cooling > 8) showHint(outputs.coolingHint, 'HINWEIS: Spreizung > 8K. Zugluftgefahr beachten.', 'warning');
        } else {
            outputs.supplyTempCooling.textContent = '-- °C';
        }
    }
    
    function showHint(element, message, type) {
        element.textContent = message;
        element.className = `info-box visible ${type}`;
    }

    function clearHints() {
        outputs.heatingHint.className = 'info-box';
        outputs.coolingHint.className = 'info-box';
    }

    // --- Event Listeners ---
    // Recalculate everything when main inputs change
    [inputs.roomArea, inputs.roomHeight, inputs.heatingLoad, inputs.coolingLoad, inputs.roomTemp].forEach(input => {
        input.addEventListener('input', () => {
            state.isInitialCalculation = true; // Allow slider range to be reset
            calculate();
        });
    });
    
    // Update slider range when min/max inputs change
    [inputs.volumeFlowMin, inputs.volumeFlowMax].forEach(input => {
        input.addEventListener('input', () => {
            state.isInitialCalculation = false; // Prevent overwriting user's choice
            calculate();
        });
    });

    // Update displays when slider moves
    inputs.volumeFlowSlider.addEventListener('input', () => {
        updateVolumeFlowDisplay();
        calculateAndDisplayTemps();
    });

    // Initial calculation on page load
    calculate();
});
