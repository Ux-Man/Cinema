#include "CinemaSeatManager.h"
#include "NavigationSystem.h"
#include "NavigationPath.h"
#include "Kismet/KismetMathLibrary.h"

ACinemaSeatManager::ACinemaSeatManager()
{
    PrimaryActorTick.bCanEverTick = false;
}

void ACinemaSeatManager::BeginPlay()
{
    Super::BeginPlay();
    Generate352SeatLayout();
}

void ACinemaSeatManager::Generate352SeatLayout()
{
    Seats.Empty(352);
    const FString Rows = TEXT("ABCDEFGHIJKLMNOPQR");

    for (int32 r = 0; r < Rows.Len(); ++r)
    {
        const FString RowLetter = Rows.Mid(r, 1);
        const bool bAccRow = (r == 0);
        const bool bPremium = (r >= 6 && r <= 12);
        const bool bCouple = (r == 13);
        const bool bVip = (r >= 14);

        const float BaseYCm = (r <= 13 ? (-1360.f + r * 132.f) : (488.f + (r - 13) * 156.f));
        const float FloorZCm = (r == 0 ? 0.f : r * 34.f);
        const float EyeOffsetCm = bVip ? 116.f : 112.f;

        int32 LeftN = bAccRow || bCouple || bVip ? 4 : 5;
        int32 CenterN = bAccRow || bVip ? 8 : (bPremium ? 12 : 10);
        int32 RightN = LeftN;
        float PitchCm = bVip ? 104.f : (bAccRow ? 92.f : (bCouple ? 88.f : (bPremium ? 76.f : 78.f)));
        float CenterHalf = ((CenterN - 1) * PitchCm) * 0.5f;
        const float AisleCm = 145.f;

        auto AddSection = [&](int32 Count, int32 StartNum, int32 SectionId)
        {
            for (int32 i = 0; i < Count; ++i)
            {
                float XCm = 0.f;
                if (SectionId == 1) XCm = -CenterHalf + i * PitchCm;
                else if (SectionId == 0) XCm = (-CenterHalf - AisleCm - PitchCm * 0.5f) - (Count - 1 - i) * PitchCm;
                else XCm = (CenterHalf + AisleCm + PitchCm * 0.5f) + i * PitchCm;

                const float ArcOffset = (XCm * XCm) * 0.000085f;
                const FVector Loc(XCm, BaseYCm - ArcOffset, FloorZCm);
                const FVector Eye(XCm, BaseYCm - ArcOffset, FloorZCm + EyeOffsetCm);

                FCinemaSeatRecord Rec;
                Rec.SeatId = FString::Printf(TEXT("%s%d"), *RowLetter, StartNum + i);
                Rec.RowLabel = RowLetter;
                Rec.SeatNumber = StartNum + i;
                Rec.WorldLocation = Loc;
                Rec.SeatedEyeLocation = Eye;
                Rec.ScreenLookRotation = UKismetMathLibrary::FindLookAtRotation(Eye, ScreenCenterCm);
                Rec.bIsAccessible = bAccRow && SectionId == 1 && (i % 2 == 0);
                Rec.Category = Rec.bIsAccessible ? ECinemaSeatCategory::Accessible
                    : (bVip ? ECinemaSeatCategory::VIP
                    : (bCouple ? ECinemaSeatCategory::Couple
                    : (bPremium ? ECinemaSeatCategory::Premium : ECinemaSeatCategory::Standard)));
                Rec.TicketPrice = bVip ? 32.f : (bCouple ? 26.f : (bPremium ? 19.f : (Rec.bIsAccessible ? 12.f : 14.f)));
                Seats.Add(Rec);
            }
        };

        AddSection(LeftN, 1, 0);
        AddSection(CenterN, LeftN + 1, 1);
        AddSection(RightN, LeftN + CenterN + 1, 2);
    }
}

bool ACinemaSeatManager::GetSeatById(const FString& SeatId, FCinemaSeatRecord& OutSeat) const
{
    for (const FCinemaSeatRecord& S : Seats)
    {
        if (S.SeatId.Equals(SeatId, ESearchCase::IgnoreCase))
        {
            OutSeat = S;
            return true;
        }
    }
    return false;
}

TArray<FVector> ACinemaSeatManager::FindNearestExitPath(const FVector& Origin, bool bAccessibleOnly) const
{
    TArray<FVector> ExitPoints = {
        FVector(-1200.f, -1560.f, 0.f),
        FVector(1200.f, -1560.f, 0.f)
    };
    if (!bAccessibleOnly)
    {
        ExitPoints.Add(FVector(-920.f, 1340.f, 578.f));
        ExitPoints.Add(FVector(920.f, 1340.f, 578.f));
    }

    FVector BestExit = ExitPoints[0];
    float BestDist = MAX_FLT;
    for (const FVector& E : ExitPoints)
    {
        const float D = FVector::Dist(Origin, E);
        if (D < BestDist) { BestDist = D; BestExit = E; }
    }

    if (UNavigationSystemV1* NavSys = UNavigationSystemV1::GetCurrent(GetWorld()))
    {
        if (UNavigationPath* Path = NavSys->FindPathToLocationSynchronously(GetWorld(), Origin, BestExit))
        {
            return Path->PathPoints;
        }
    }
    return { Origin, BestExit };
}
