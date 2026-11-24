#include "CinemaLightingController.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

ACinemaLightingController::ACinemaLightingController()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ACinemaLightingController::ApplyLightingPreset(ECinemaLightingPreset Preset)
{
    switch (Preset)
    {
    case ECinemaLightingPreset::FullLights:
        TargetCeilingIntensity = 0.95f; TargetWallSlatsIntensity = 0.95f; TargetScreenBrightness = 0.85f; TargetColorTempK = 3800.f; break;
    case ECinemaLightingPreset::PreShow:
        TargetCeilingIntensity = 0.42f; TargetWallSlatsIntensity = 0.82f; TargetScreenBrightness = 1.10f; TargetColorTempK = 3000.f; break;
    case ECinemaLightingPreset::MovieMode:
        TargetCeilingIntensity = 0.05f; TargetWallSlatsIntensity = 0.24f; TargetScreenBrightness = 1.35f; TargetColorTempK = 2700.f; break;
    case ECinemaLightingPreset::Intermission:
        TargetCeilingIntensity = 0.58f; TargetWallSlatsIntensity = 0.75f; TargetScreenBrightness = 0.75f; TargetColorTempK = 3400.f; break;
    case ECinemaLightingPreset::Cleaning:
        TargetCeilingIntensity = 1.00f; TargetWallSlatsIntensity = 0.60f; TargetScreenBrightness = 0.25f; TargetColorTempK = 5600.f; break;
    case ECinemaLightingPreset::Emergency:
        TargetCeilingIntensity = 0.12f; TargetWallSlatsIntensity = 0.10f; TargetScreenBrightness = 0.20f; TargetColorTempK = 4800.f; break;
    default:
        break;
    }
}

void ACinemaLightingController::HandlePixelStreamingJson(const FString& DescriptorJson)
{
    TSharedPtr<FJsonObject> RootObj;
    const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(DescriptorJson);
    if (!FJsonSerializer::Deserialize(Reader, RootObj) || !RootObj.IsValid()) return;

    const FString Type = RootObj->GetStringField(TEXT("type"));
    const TSharedPtr<FJsonObject>* PayloadObj = nullptr;
    if (!RootObj->TryGetObjectField(TEXT("payload"), PayloadObj)) return;

    if (Type == TEXT("SetLightingPreset"))
    {
        const FString PresetStr = (*PayloadObj)->GetStringField(TEXT("preset"));
        if (PresetStr == TEXT("full")) ApplyLightingPreset(ECinemaLightingPreset::FullLights);
        else if (PresetStr == TEXT("preshow")) ApplyLightingPreset(ECinemaLightingPreset::PreShow);
        else if (PresetStr == TEXT("movie")) ApplyLightingPreset(ECinemaLightingPreset::MovieMode);
        else if (PresetStr == TEXT("intermission")) ApplyLightingPreset(ECinemaLightingPreset::Intermission);
        else if (PresetStr == TEXT("cleaning")) ApplyLightingPreset(ECinemaLightingPreset::Cleaning);
        else if (PresetStr == TEXT("emergency")) ApplyLightingPreset(ECinemaLightingPreset::Emergency);
    }
    else if (Type == TEXT("SetLightingParam"))
    {
        double Val = 0.0;
        if ((*PayloadObj)->TryGetNumberField(TEXT("ceilingLights"), Val)) TargetCeilingIntensity = static_cast<float>(Val);
        if ((*PayloadObj)->TryGetNumberField(TEXT("wallSlats"), Val)) TargetWallSlatsIntensity = static_cast<float>(Val);
        if ((*PayloadObj)->TryGetNumberField(TEXT("screenBrightness"), Val)) TargetScreenBrightness = static_cast<float>(Val);
        if ((*PayloadObj)->TryGetNumberField(TEXT("colorTemperature"), Val)) TargetColorTempK = static_cast<float>(Val);
    }
}

void ACinemaLightingController::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    CurrentCeilingIntensity = FMath::FInterpTo(CurrentCeilingIntensity, TargetCeilingIntensity, DeltaTime, 3.5f);
    CurrentWallSlatsIntensity = FMath::FInterpTo(CurrentWallSlatsIntensity, TargetWallSlatsIntensity, DeltaTime, 3.5f);
}
