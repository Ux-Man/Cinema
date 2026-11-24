#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CinemaLightingController.generated.h"

UENUM(BlueprintType)
enum class ECinemaLightingPreset : uint8
{
    FullLights,
    PreShow,
    MovieMode,
    Intermission,
    Cleaning,
    Emergency,
    Custom
};

UCLASS()
class IMMERSIVECINEMA5_API ACinemaLightingController : public AActor
{
    GENERATED_BODY()

public:
    ACinemaLightingController();

    UFUNCTION(BlueprintCallable, Category = "Cinema|Lighting")
    void ApplyLightingPreset(ECinemaLightingPreset Preset);

    UFUNCTION(BlueprintCallable, Category = "Cinema|PixelStreaming")
    void HandlePixelStreamingJson(const FString& DescriptorJson);

protected:
    virtual void Tick(float DeltaTime) override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cinema|Lighting")
    float TargetCeilingIntensity = 0.45f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cinema|Lighting")
    float TargetWallSlatsIntensity = 0.85f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cinema|Lighting")
    float TargetScreenBrightness = 1.15f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cinema|Lighting")
    float TargetColorTempK = 3000.f;

    float CurrentCeilingIntensity = 0.45f;
    float CurrentWallSlatsIntensity = 0.85f;
};
