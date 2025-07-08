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
        isInitialCalculation: true
    };

    // Hauptfunktion, die alle Berechnungen auslöst
    function runCalculations() {
        // 1. Hole alle aktuellen Werte
        const roomArea = parseFloat(inputs.roomArea.value) || 0;
        const roomHeight = parseFloat(inputs.roomHeight.value) || 0;
        const heatingLoadKW = parseFloat(inputs.heatingLoad.value) || 0;
        const coolingLoadKW = parseFloat(inputs.coolingLoad.value) || 0;
        const totalHeatingLoadWatts = heatingLoadKW * 1000;
        const totalCoolingLoadWatts = coolingLoadKW * 1000;
        
        // 2. Aktualisiere den Bereich des Schiebereglers
        if (roomArea > 0 && roomHeight > 0) {
            updateSliderRangeAndValue(roomArea, roomHeight, totalHeatingLoadWatts, totalCoolingLoadWatts);
        }

        // 3. Aktualisiere alle Anzeigen
        updateVolumeFlowDisplay();
        calculateAndDisplayTemps();

        // Nach der ersten Berechnung wird dieser Flag auf false gesetzt
        state.isInitialCalculation = false;
    }

    // Aktualisiert die Min/Max-Werte und den Schieberegler selbst
    function updateSliderRangeAndValue(roomArea, roomHeight, heatingLoad, coolingLoad) {
        const roomVolume = roomArea * roomHeight;
        const hygienicFlow = roomVolume * 2; // Hygienischer Luftwechsel (2-fach)
        outputs.recommendedVolumeFlow.textContent = `${hygienicFlow.toFixed(0)} m³/h`;

        // Schätze einen Volumenstrom, der für die Lasten benötigt wird (bei 8K Spreizung)
        const maxLoad = Math.max(heatingLoad, coolingLoad, 1);
        const loadBasedFlow = maxLoad / (airProperties.cp * 8);

        // Bei der allerersten Berechnung werden die Min/Max-Felder vorbelegt
        if (state.isInitialCalculation) {
            const calculatedMin = Math.floor(hygienicFlow / 2 / 10) * 10;
            // Max-Wert berücksichtigt Hygiene, Last und eine hohe Labor-Luftwechselrate (8-fach)
            const calculatedMax = Math.ceil(Math.max(hygienicFlow, loadBasedFlow, roomVolume * 8) * 1.5 / 100) * 100;
            
            inputs.volumeFlowMin.value = Math.max(0, calculatedMin);
            inputs.volumeFlowMax.value = Math.max(500, calculatedMax); // Mindestens 500 als Max-Wert
            
            // Setze den Schieberegler auf einen sinnvollen Startwert
            inputs.volumeFlowSlider.value = hygienicFlow.toFixed(0);
        }

        // Lese die Werte aus den Min/Max-Feldern und weise sie dem Schieberegler zu
        const min = parseFloat(inputs.volumeFlowMin.value) || 0;
        const max = parseFloat(inputs.volumeFlowMax.value) || 1000;
        inputs.volumeFlowSlider.min = min;
        inputs.volumeFlowSlider.max = max;

        // Stelle sicher, dass der aktuelle Wert des Reglers innerhalb der neuen Grenzen liegt
        if (parseFloat(inputs.volumeFlowSlider.value) < min) inputs.volumeFlowSlider.value = min;
        if (parseFloat(inputs.volumeFlowSlider.value) > max) inputs.volumeFlowSlider.value = max;
    }
    
    // Aktualisiert die Textanzeige für den Volumenstrom und die Luftwechselrate
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
    
    // Berechnet und zeigt die Zulufttemperaturen an
    function calculateAndDisplayTemps() {
        const volumeFlow = parseFloat(inputs.volumeFlowSlider.value);
        const roomTemp = parseFloat(inputs.roomTemp.value) || 21;
        const heatingLoadWatts = (parseFloat(inputs.heatingLoad.value) || 0) * 1000;
        const coolingLoadWatts = (parseFloat(inputs.coolingLoad.value) || 0) * 1000;

        clearHints();

        if (volumeFlow === 0) {
            outputs.supplyTempHeating.textContent = '-- °C';
            outputs.supplyTempCooling.textContent = '-- °C';
            return;
        }

        // --- HEIZEN ---
        if (heatingLoadWatts > 0) {
            const deltaT_heating = heatingLoadWatts / (volumeFlow * airProperties.cp);
            const tempHeating = roomTemp + deltaT_heating;
            outputs.supplyTempHeating.textContent = `${tempHeating.toFixed(1)} °C`;
            if (deltaT_heating > 20) showHint(outputs.heatingHint, 'KRITISCH: Sehr hohe Übertemperatur!', 'critical');
            else if (deltaT_heating > 15) showHint(outputs.heatingHint, 'HINWEIS: Hohe Übertemperatur.', 'warning');
        } else {
            outputs.supplyTempHeating.textContent = '-- °C';
        }

        // --- KÜHLEN ---
        if (coolingLoadWatts > 0) {
            const deltaT_cooling = coolingLoadWatts / (volumeFlow * airProperties.cp);
            const tempCooling = roomTemp - deltaT_cooling;
            outputs.supplyTempCooling.textContent = `${tempCooling.toFixed(1)} °C`;
            if (deltaT_cooling > 10) showHint(outputs.coolingHint, 'KRITISCH: Sehr hohe Spreizung! Zugluftgefahr!', 'critical');
            else if (deltaT_cooling > 8) showHint(outputs.coolingHint, 'HINWEIS: Spreizung > 8K, Zugluft beachten.', 'warning');
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

    // --- EVENT LISTENERS ---
    
    // Wenn sich einer der Haupt-Inputs ändert, wird alles neu berechnet und die Min/Max-Felder werden zurückgesetzt
    [inputs.roomArea, inputs.roomHeight, inputs.heatingLoad, inputs.coolingLoad, inputs.roomTemp].forEach(input => {
        input.addEventListener('input', () => {
            state.isInitialCalculation = true;
            runCalculations();
        });
    });
    
    // Wenn der User die Min/Max-Felder ändert, wird der Regler angepasst, aber die Felder nicht überschrieben
    [inputs.volumeFlowMin, inputs.volumeFlowMax].forEach(input => {
        input.addEventListener('input', () => {
            state.isInitialCalculation = false;
            runCalculations();
        });
    });

    // Wenn der Schieberegler bewegt wird, werden nur die Anzeigen aktualisiert
    inputs.volumeFlowSlider.addEventListener('input', () => {
        updateVolumeFlowDisplay();
        calculateAndDisplayTemps();
    });

    // Starte die Berechnungen beim Laden der Seite
    runCalculations();
});
