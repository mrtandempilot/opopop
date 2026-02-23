/**
 * tools/weather.ts — Weather tool using OpenWeatherMap.
 */

import { config } from "../config.js";

export async function getWeather(city: string): Promise<string> {
    if (!config.weatherApiKey) {
        return "❌ Weather API key is missing. Please set OPENWEATHER_API_KEY in .env";
    }

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${config.weatherApiKey}&units=metric&lang=tr`;
        const res = await fetch(url);

        if (!res.ok) {
            if (res.status === 401) return "❌ Hava durumu API anahtarı geçersiz.";
            if (res.status === 404) return `❌ "${city}" şehri bulunamadı.`;
            return `❌ Hava durumu alınırken hata oluştu (Status: ${res.status})`;
        }

        const data: any = await res.json();
        const temp = Math.round(data.main.temp);
        const desc = data.weather[0].description;
        const humidity = data.main.humidity;
        const feelsLike = Math.round(data.main.feels_like);

        return `🌤️ **${data.name}** için hava durumu:
• Sıcaklık: ${temp}°C (Hissedilen: ${feelsLike}°C)
• Durum: ${desc}
• Nem: %${humidity}`;
    } catch (err: any) {
        console.error("[weather] Error:", err.message);
        return "❌ Hava durumu verisi alınırken bir teknik hata oluştu.";
    }
}

export const weatherGetTool = {
    name: "weather_get",
    description: "Gets the current weather for a specific city.",
    input_schema: {
        type: "object" as const,
        properties: {
            city: { type: "string", description: "City name (e.g. Istanbul, London)." },
        },
        required: ["city"],
    },
};

export async function executeWeatherTool(name: string, input: Record<string, unknown>): Promise<string> {
    switch (name) {
        case "weather_get":
            return getWeather(String(input.city));
        default:
            return `Bilinmeyen weather işlemi: ${name}`;
    }
}
