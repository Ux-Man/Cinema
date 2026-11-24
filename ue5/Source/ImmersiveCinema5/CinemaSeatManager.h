#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CinemaSeatManager.generated.h"

UENUM(BlueprintType)
enum class ECinemaSeatCategory : uint8
{
    Standard,
    Premium,
    Couple,
    VIP,
    Accessible
};

USTRUCT(BlueprintType)
struct FCinemaSeatRecord
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly) FString SeatId;
    UPROPERTY(BlueprintReadOnly) FString RowLabel;
    UPROPERTY(BlueprintReadOnly) int32 SeatNumber = 1;
    UPROPERTY(BlueprintReadOnly) ECinemaSeatCategory Category = ECinemaSeatCategory::Standard;
    UPROPERTY(BlueprintReadOnly) float TicketPrice = 14.0f;
    UPROPERTY(BlueprintReadOnly) FVector WorldLocation = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly) FVector SeatedEyeLocation = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly) FRotator ScreenLookRotation = FRotator::ZeroRotator;
    UPROPERTY(BlueprintReadOnly) bool bIsAccessible = false;
};

UCLASS()
class IMMERSIVECINEMA5_API ACinemaSeatManager : public AActor
{
    GENERATED_BODY()

public:
    ACinemaSeatManager();

    UFUNCTION(BlueprintCallable, Category = "Cinema|Seats")
    void Generate352SeatLayout();

    UFUNCTION(BlueprintCallable, Category = "Cinema|Seats")
    bool GetSeatById(const FString& SeatId, FCinemaSeatRecord& OutSeat) const;

    UFUNCTION(BlueprintCallable, Category = "Cinema|Wayfinding")
    TArray<FVector> FindNearestExitPath(const FVector& Origin, bool bAccessibleOnly) const;

protected:
    virtual void BeginPlay() override;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Cinema|Seats")
    TArray<FCinemaSeatRecord> Seats;

    UPROPERTY(EditAnywhere, Category = "Cinema|Screen")
    FVector ScreenCenterCm = FVector(0.f, -1920.f, 550.f);
};
