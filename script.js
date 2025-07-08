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
    
    // ----- HAUPTFUNKTIONEN -----

    function runInitialCalculations() {
        const roomArea = parseFloat(inputs.roomArea.value) || 0;
        const roomHeight = parseFloat(inputs.roomHeight.value) || 0;
        
        if (roomArea > 0 && roomHeight > 0) {
            const roomVolume = roomArea * roomHeight;
            const heatingLoadWatts = (parseFloat(inputs.heatingLoad.value) || 0) * 1000;
            const coolingLoadWatts = (parseFloat(inputs.coolingLoad.value) || 0) * 1000;

            const hygienicFlow = roomVolume * 2;
            outputs.recommendedVolumeFlow.textContent = `${hygienicFlow.toFixed(0)} m³/h`;

            const maxLoad = Math.max(heatingLoadWatts, coolingLoadWatts, 1);
            const loadBasedFlow = maxLoad / (airProperties.cp * 8);
            const calculatedMin = Math.floor(hygienicFlow / 2 / 10) * 10;
            const calculatedMax = Math.ceil(Math.max(hygienicFlow, loadBasedFlow, roomVolume * 8) * 1.5 / 100) * 100;
            
            inputs.volumeFlowMin.value = Math.max(0, calculatedMin);
            inputs.volumeFlowMax.value = Math.max(500, calculatedMax);
            
            inputs.volumeFlowSlider.value = hygienicFlow.toFixed(0);
        }
        
        updateSliderFromMinMaxInputs();
    }
    
    function updateSliderFromMinMaxInputs() {
        let min = parseFloat(inputs.volumeFlowMin.value) || 0;
        let max = parseFloat(inputs.volumeFlowMax.value) || 1000;

        // KORREKTUR: Verhindert, dass der Regler blockiert
        if (min >= max) {
            min = Math.floor(max * 0.8 / 10) * 10; // min wird auf 80% von max gesetzt
            inputs.volumeFlowMin.value = min; // Korrigierten Wert im Feld anzeigen
        }

        inputs.volumeFlowSlider.min = min;
        inputs.volumeFlowSlider.max = max;

        if (parseFloat(inputs.volumeFlowSlider.value) < min) inputs.volumeFlowSlider.value = min;
        if (parseFloat(inputs.volumeFlowSlider.value) > max) inputs.volumeFlowSlider.value = max;

        updateAllDisplays();
    }

    function updateAllDisplays() {
        const volumeFlow = parseFloat(inputs.volumeFlowSlider.value);
        outputs.volumeFlowValue.textContent = volumeFlow.toFixed(0);
        updateAirChangeRateDisplay(volumeFlow);
        calculateAndDisplayTemps(volumeFlow);
    }
    
    // ----- HILFSFUNKTIONEN -----

    function updateAirChangeRateDisplay(volumeFlow) {
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

    function calculateAndDisplayTemps(volumeFlow) {
        const roomTemp = parseFloat(inputs.roomTemp.value) || 21;
        const heatingLoadWatts = (parseFloat(inputs.heatingLoad.value) || 0) * 1000;
        const coolingLoadWatts = (parseFloat(inputs.coolingLoad.value) || 0) * 1000;

        clearHints();

        if (volumeFlow === 0) {
            outputs.supplyTempHeating.textContent = '-- °C';
            outputs.supplyTempCooling.textContent = '-- °C';
            return;
        }

        if (heatingLoadWatts > 0) {
            const deltaT = heatingLoadWatts / (volumeFlow * airProperties.cp);
            outputs.supplyTempHeating.textContent = `${(roomTemp + deltaT).toFixed(1)} °C`;
            if (deltaT > 20) showHint(outputs.heatingHint, 'KRITISCH: Sehr hohe Übertemperatur!', 'critical');
            else if (deltaT > 15) showHint(outputs.heatingHint, 'HINWEIS: Hohe Übertemperatur.', 'warning');
        } else {
            outputs.supplyTempHeating.textContent = '-- °C';
        }

        if (coolingLoadWatts > 0) {
            const deltaT = coolingLoadWatts / (volumeFlow * airProperties.cp);
            outputs.supplyTempCooling.textContent = `${(roomTemp - deltaT).toFixed(1)} °C`;
            if (deltaT > 10) showHint(outputs.coolingHint, 'KRITISCH: Sehr hohe Spreizung! Zugluftgefahr!', 'critical');
            else if (deltaT > 8) showHint(outputs.coolingHint, 'HINWEIS: Spreizung > 8K, Zugluft beachten.', 'warning');
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

    // ----- EVENT LISTENERS -----
    
    [inputs.roomArea, inputs.roomHeight, inputs.heatingLoad, inputs.coolingLoad, inputs.roomTemp].forEach(input => {
        input.addEventListener('input', runInitialCalculations);
    });
    
    [inputs.volumeFlowMin, inputs.volumeFlowMax].forEach(input => {
        input.addEventListener('input', updateSliderFromMinMaxInputs);
    });

    inputs.volumeFlowSlider.addEventListener('input', updateAllDisplays);

    runInitialCalculations();
});
