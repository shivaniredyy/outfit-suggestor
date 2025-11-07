const API_KEY = "f3a62833a8a48296549573db48dea2e9";

const cityInput = document.getElementById("cityInput");
const checkBtn = document.getElementById("checkBtn");
const locBtn = document.getElementById("locBtn");
const result = document.getElementById("result");
const favoritesList = document.getElementById("favoritesList");
const forecastDiv = document.getElementById("forecast");
const app = document.querySelector(".app");
const webcam = document.getElementById("webcam");
const canvas = document.getElementById("photoCanvas");
const ctx = canvas.getContext("2d");
const startCamBtn = document.getElementById("startCamBtn");
const snapshotBtn = document.getElementById("snapshotBtn");

let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
let history = JSON.parse(localStorage.getItem("history")) || [];
let net;
let currentOutfit = "";

// Outfit suggestions
const outfitImgMap = {
  "T-shirt + Shorts + Sunglasses 😎": "outfits/tshirt.png",
  "Raincoat + Boots + Umbrella ☔": "outfits/raincoat.png",
  "Winter Jacket + Gloves + Boots ❄️": "outfits/winter_jacket.png",
  "Sweater + Jeans + Sneakers 👕": "outfits/sweater.png",
  "Casual Outfit 👗": "outfits/casual.png"
};

// Load PoseNet
async function loadPoseNet() {
  net = await posenet.load();
}
loadPoseNet();

// -------------------- Favorites & History --------------------
function renderFavorites() {
  favoritesList.innerHTML = "";
  favorites.forEach(f => {
    const li = document.createElement("li");
    li.textContent = `${f.city} - ${f.temp}°C - ${f.outfit}`;
    favoritesList.appendChild(li);
  });
}

function addFavorite(city, temp, outfit) {
  if (!favorites.some(f => f.city === city)) {
    favorites.push({ city, temp, outfit });
    localStorage.setItem("favorites", JSON.stringify(favorites));
    renderFavorites();
  }
}

function addHistory(city, outfit) {
  history.push({ city, outfit, date: new Date().toLocaleString() });
  localStorage.setItem("history", JSON.stringify(history));
}

// Initial render
renderFavorites();

// -------------------- Weather & Forecast --------------------
function getOutfit(condition, temp) {
  if (temp > 30) return "T-shirt + Shorts + Sunglasses 😎";
  if (temp < 10) return "Winter Jacket + Gloves + Boots ❄️";
  switch (condition.toLowerCase()) {
    case "rain": return "Raincoat + Boots + Umbrella ☔";
    case "snow": return "Winter Jacket + Gloves + Boots ❄️";
    case "clouds": return "Sweater + Jeans + Sneakers 👕";
    case "thunderstorm": return "Waterproof Jacket + Umbrella ⚡";
    default: return "Casual Outfit 👗";
  }
}

function setBackground(condition) {
  app.className = "app";
  switch (condition.toLowerCase()) {
    case "clear": app.classList.add("sunny"); break;
    case "rain": app.classList.add("rainy"); break;
    case "snow": app.classList.add("snowy"); break;
    case "clouds": app.classList.add("cloudy"); break;
    case "thunderstorm": app.classList.add("storm"); break;
  }
}

async function fetchWeather(city) {
  if (!city) return;
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`);
    const data = await res.json();
    if (data.weather) {
      const condition = data.weather[0].main;
      const temp = Math.round(data.main.temp);
      currentOutfit = getOutfit(condition, temp);
      setBackground(condition);

      result.innerHTML = `
        <h2>${data.name}, ${data.sys.country}</h2>
        <p>${temp}°C | ${condition}</p>
        <p>Suggested Outfit: <strong>${currentOutfit}</strong></p>
        <button id="favBtn">Add to Favorites ❤️</button>
        <button id="historyBtn">Add to History 📜</button>
      `;

      document.getElementById("favBtn").onclick = () => addFavorite(data.name, temp, currentOutfit);
      document.getElementById("historyBtn").onclick = () => addHistory(data.name, currentOutfit);

      fetchForecast(data.name);
      startLiveTryOn();
    } else {
      result.innerHTML = "<p>City not found</p>";
    }
  } catch (e) {
    result.innerHTML = "<p>Error fetching weather</p>";
  }
}

async function fetchForecast(city) {
  forecastDiv.innerHTML = "";
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEY}&units=metric`);
    const data = await res.json();
    const daily = data.list.filter((v, i) => i % 8 === 0);
    daily.forEach(day => {
      const date = new Date(day.dt_txt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const condition = day.weather[0].main;
      const temp = Math.round(day.main.temp);
      const outfit = getOutfit(condition, temp);
      const card = document.createElement("div");
      card.className = "forecast-card";
      card.innerHTML = `<p>${date}</p><p>${temp}°C | ${condition}</p><p>${outfit}</p>`;
      forecastDiv.appendChild(card);
    });
  } catch (e) {
    forecastDiv.innerHTML = "<p>Error loading forecast</p>";
  }
}

// -------------------- Webcam & Live Try-On --------------------
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Webcam not supported");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    webcam.srcObject = stream;
    await webcam.play();
    canvas.width = webcam.videoWidth;
    canvas.height = webcam.videoHeight;
    startLiveTryOn();
  } catch (err) {
    alert("Webcam error: " + err.message);
  }
}

startCamBtn.onclick = startCamera;

snapshotBtn.onclick = () => {
  const link = document.createElement("a");
  link.download = "my_outfit.png";
  link.href = canvas.toDataURL();
  link.click();
};

async function startLiveTryOn() {
  if (!net || !currentOutfit || webcam.readyState !== 4) return;
  const outfitFile = outfitImgMap[currentOutfit];
  if (!outfitFile) return;
  const outfitImg = new Image();
  outfitImg.src = outfitFile;

  async function drawFrame() {
    if (webcam.readyState === 4) {
      canvas.width = webcam.videoWidth;
      canvas.height = webcam.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);

      const pose = await net.estimateSinglePose(webcam, { flipHorizontal: true });
      const leftShoulder = pose.keypoints.find(k => k.part === "leftShoulder");
      const rightShoulder = pose.keypoints.find(k => k.part === "rightShoulder");
      const nose = pose.keypoints.find(k => k.part === "nose");

      if (leftShoulder && rightShoulder && nose) {
        const width = rightShoulder.position.x - leftShoulder.position.x + 50;
        const height = width;
        const x = leftShoulder.position.x - 25;
        const y = nose.position.y + 20;
        ctx.drawImage(outfitImg, x, y, width, height);
      }
    }
    requestAnimationFrame(drawFrame);
  }

  drawFrame();
}

// -------------------- Event Listeners --------------------
checkBtn.onclick = () => fetchWeather(cityInput.value);

locBtn.onclick = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
    });
  } else {
    alert("Geolocation not supported");
  }
};

async function fetchWeatherByCoords(lat, lon) {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
    const data = await res.json();
    if (data.weather) {
      const condition = data.weather[0].main;
      const temp = Math.round(data.main.temp);
      currentOutfit = getOutfit(condition, temp);
      setBackground(condition);

      result.innerHTML = `
        <h2>${data.name}, ${data.sys.country}</h2>
        <p>${temp}°C | ${condition}</p>
        <p>Suggested Outfit: <strong>${currentOutfit}</strong></p>
        <button id="favBtn">Add to Favorites ❤️</button>
        <button id="historyBtn">Add to History 📜</button>
      `;

      document.getElementById("favBtn").onclick = () => addFavorite(data.name, temp, currentOutfit);
      document.getElementById("historyBtn").onclick = () => addHistory(data.name, currentOutfit);

      fetchForecast(data.name);
      startLiveTryOn();
    }
  } catch (e) {
    result.innerHTML = "<p>Error fetching weather</p>";
  }
}
