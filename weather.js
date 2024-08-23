function fetchWeatherData(lat, lon) {

    
    const apiKey = '2104d9d37c8a23ad320028a54d513d8a'; // Replace with your OpenWeatherMap API key
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            displayWeatherData(data);
        })
        .catch(error => console.error('Error fetching weather data:', error));
}

// Display weather data on the webpage
function displayWeatherData(data) {
    const weatherDiv = document.getElementById('results');
    weatherDiv.innerHTML = '';

    const weatherInfo = document.createElement('div');
    weatherInfo.style.display = 'flex';
    weatherInfo.style.alignItems = 'center';
    weatherInfo.style.padding = '10px';
    weatherInfo.style.backgroundColor = '#1a1a2e';
    weatherInfo.style.borderRadius = '10px';
    weatherInfo.style.color = 'white';

    const icon = document.createElement('img');
    icon.src = `http://openweathermap.org/img/wn/${data.weather[0].icon}.png`;
    icon.alt = data.weather[0].description;
    icon.style.width = '50px';
    icon.style.height = '50px';

    const details = document.createElement('div');
    details.style.marginLeft = '10px';
    details.innerHTML = `
        <div style="font-size: 16px;">${data.main.temp.toFixed(1)}°C</div>
        <div style="font-size: 14px;">${data.weather[0].description}</div>
    `;

    weatherInfo.appendChild(icon);
    weatherInfo.appendChild(details);
    weatherDiv.appendChild(weatherInfo);
}
