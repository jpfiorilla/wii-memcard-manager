import { Box } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

type PipelineArrowProps = {
  isNarrow: boolean;
};

export function PipelineArrow({ isNarrow }: PipelineArrowProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: isNarrow ? 0 : 1,
        py: isNarrow ? 1 : 0,
        color: "secondary.light",
      }}
    >
      {isNarrow ? (
        <ArrowDownwardIcon sx={{ fontSize: 36, opacity: 0.85 }} />
      ) : (
        <ArrowForwardIcon sx={{ fontSize: 40, opacity: 0.9 }} />
      )}
    </Box>
  );
}
